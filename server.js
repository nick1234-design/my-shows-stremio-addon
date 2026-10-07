const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Stremio requires CORS headers on every HTTP addon route.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Tell Stremio (and browsers) it may reuse catalog responses for a while.
app.use((req, res, next) => {

  if(req.path.includes("/catalog/")){

    const originalJson = res.json.bind(res);

    res.json = body => {

      if(body && Array.isArray(body.metas)){
        body.cacheMaxAge = 1800;
        body.staleRevalidate = 3600;
        res.setHeader("Cache-Control", "public, max-age=1800");
      }

      return originalJson(body);

    };

  }

  next();

});

const DEFAULT_SHOWS = [
  {
    name: "The Drop: A Snowfall Saga",
    tmdbId: 304842
  },
  {
    name: "MobLand",
    tmdbId: 247718
  },
  {
    name: "Anna Pigeon",
    tmdbId: 291350
  }
];

function tmdbUrl(path) {

  return (
    "https://api.themoviedb.org/3" +
    path
  );

}

function imageUrl(
  path,
  size = "w500"
){

  if(!path){
    return undefined;
  }

  return (
    "https://image.tmdb.org/t/p/" +
    size +
    path
  );

}

function formatDate(
  dateString
){

  if(!dateString){
    return null;
  }

  const date =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return date.toLocaleDateString(
    "en-US",
    {
      month:"short",
      day:"numeric",
      year:"numeric",
      timeZone:"UTC"
    }
  );

}

function isWithinNext7Days(
  dateString
){

  if(!dateString){
    return false;
  }

  const today =
    new Date();

  today.setUTCHours(
    0,
    0,
    0,
    0
  );

  const target =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  const sevenDays =
    new Date(today);

  sevenDays.setUTCDate(
    sevenDays.getUTCDate() +
    7
  );

  return (
    target >= today &&
    target <= sevenDays
  );

}

const DEFAULT_ROWS = [
  "myshows",
  "whatsnext"
];

const ALL_ROWS = [
  "myshows",
  "whatsnext",
  "airingthisweek",
  "recentlyaired",
  "returningsoon"
];

const DEFAULT_SORT = "myorder";

const ALL_SORTS = [
  "myorder",
  "nextepisode",
  "recentlyaired",
  "alphabetical"
];

function getShowPartFromConfig(
  config
){

  if(!config){
    return "";
  }

  return String(config)
    .split("~")[0];

}

function getRowsFromConfig(
  config
){

  if(
    !config ||
    !String(config).includes("~")
  ){

    return DEFAULT_ROWS;

  }

  const rowPart =
    String(config)
      .split("~")[1] || "";

  const rows =
    rowPart
      .split(",")
      .map(
        row =>
          row.trim()
      )
      .filter(
        row =>
          ALL_ROWS.includes(row)
      );

  return rows.length > 0
    ? rows
    : DEFAULT_ROWS;

}

function getSortFromConfig(
  config
){

  if(
    !config ||
    !String(config).includes("~")
  ){

    return DEFAULT_SORT;

  }

  const parts =
    String(config)
      .split("~");

  const sort =
    String(
      parts[2] || ""
    ).trim();

  return ALL_SORTS.includes(sort)
    ? sort
    : DEFAULT_SORT;

}

function getShowsFromConfig(
  config
){

  if(!config){
    return DEFAULT_SHOWS;
  }

  const showPart =
    getShowPartFromConfig(
      config
    );

  const ids =
    showPart
      .split(",")
      .map(
        id =>
          id.trim()
      )
      .filter(
        id =>
          /^\d+$/.test(id)
      );

  if(ids.length === 0){
    return DEFAULT_SHOWS;
  }

  return ids.map(
    id => ({
      tmdbId:
        Number(id)
    })
  );

}

function sortMyShows(
  items,
  sort
){

  if(
    sort ===
    "alphabetical"
  ){

    return items.sort(
      (a,b) =>
        a.data.name.localeCompare(
          b.data.name
        )
    );

  }

  if(
    sort ===
    "nextepisode"
  ){

    return items.sort(
      (a,b) => {

        const aTime =
          a.nextTime ??
          Number.MAX_SAFE_INTEGER;

        const bTime =
          b.nextTime ??
          Number.MAX_SAFE_INTEGER;

        return (
          aTime -
          bTime ||
          a.originalIndex -
          b.originalIndex
        );

      }
    );

  }

  if(
    sort ===
    "recentlyaired"
  ){

    return items.sort(
      (a,b) => {

        const aTime =
          a.lastTime ??
          0;

        const bTime =
          b.lastTime ??
          0;

        return (
          bTime -
          aTime ||
          a.originalIndex -
          b.originalIndex
        );

      }
    );

  }

  return items.sort(
    (a,b) =>
      a.originalIndex -
      b.originalIndex
  );

}

// Every server-side TMDB request gives up after 8 seconds instead of hanging.
axios.defaults.timeout = 8000;

/*
====================================================
TMDB CACHE
- Fresh for 30 minutes
- Identical in-flight requests are shared
- If TMDB fails, a cached copy up to 24h old is served instead
====================================================
*/

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;

const tmdbCache = new Map();
const tmdbInflight = new Map();

async function cachedTmdb(key, fetcher){

  const now = Date.now();
  const hit = tmdbCache.get(key);

  if(hit && now - hit.time < CACHE_TTL_MS){
    return hit.value;
  }

  if(tmdbInflight.has(key)){
    return tmdbInflight.get(key);
  }

  const promise = (async () => {

    try{

      const value = await fetcher();

      tmdbCache.delete(key);
      tmdbCache.set(key, { value, time: Date.now() });

      while(tmdbCache.size > CACHE_MAX_ENTRIES){
        tmdbCache.delete(tmdbCache.keys().next().value);
      }

      return value;

    }catch(error){

      if(hit && now - hit.time < CACHE_STALE_MS){
        console.error("TMDB error, serving stale copy of", key, error.message);
        return hit.value;
      }

      throw error;

    }finally{

      tmdbInflight.delete(key);

    }

  })();

  tmdbInflight.set(key, promise);

  return promise;

}

// Runs fn over items with at most `limit` requests at once.
async function mapLimit(items, limit, fn){

  const results = new Array(items.length);
  let next = 0;

  async function worker(){
    while(next < items.length){
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      worker
    )
  );

  return results;

}

// Warms the cache for a list of shows in parallel. Failures are ignored here;
// the normal per-show loops still log and skip them.
async function prefetchShows(shows){

  await mapLimit(
    shows,
    8,
    show =>
      getShowDetails(show.tmdbId).catch(() => null)
  );

}

async function getShowDetails(
  tmdbId
){

  return cachedTmdb(
    "show:" + tmdbId,
    async () => {

      const response =
        await axios.get(
          tmdbUrl("/tv/" + tmdbId),
          {
            params:{
              api_key:
                TMDB_API_KEY
            }
          }
        );

      return response.data;

    }
  );

}

async function getSeasonEpisodes(
  tmdbId,
  seasonNumber
){

  return cachedTmdb(
    "season:" + tmdbId + ":" + seasonNumber,
    async () => {

      const response =
        await axios.get(
          tmdbUrl(
            "/tv/" +
            tmdbId +
            "/season/" +
            seasonNumber
          ),
          {
            params:{
              api_key:
                TMDB_API_KEY
            }
          }
        );

      return (
        response.data.episodes ||
        []
      );

    }
  );

}


/*
====================================================
HOME
====================================================
*/

async function sendHome(
  req,
  res
){

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>My Shows</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111;
  color:#fff;
  margin:0;
  padding:24px;
}

.container{
  max-width:900px;
  margin:auto;
}

h1{
  margin-bottom:8px;
}

p{
  color:#aaa;
}

a{
  color:#fff;
}

</style>

</head>

<body>

<div class="container">

<h1>My Shows</h1>

<p>
Personal Stremio TV show tracker.
</p>

<p>
<a href="/configure">
Configure My Shows
</a>
</p>

</div>

</body>
</html>
  `);

}

app.get(
  "/",
  async (req,res) => {

    await sendHome(
      req,
      res
    );

  }
);


/*
====================================================
CONFIGURE PAGE
====================================================
*/

async function sendConfigure(
  req,
  res,
  config
){

  const initialIds =
    getShowPartFromConfig(
      config
    )
    .split(",")
    .map(
      id =>
        id.trim()
    )
    .filter(
      id =>
        /^\d+$/.test(id)
    );

  const initialRows =
    getRowsFromConfig(
      config
    );

  const initialSort =
    getSortFromConfig(
      config
    );

  res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>

<meta name="theme-color" content="#0b0e1f">

<title>
My Shows Configure
</title>

<style>

:root{
  --bg:#0a0d1e;
  --card:rgba(255,255,255,.045);
  --card-border:rgba(255,255,255,.08);
  --text:#eef0ff;
  --muted:#9aa0c3;
  --accent:#8b5cf6;
  --accent2:#6366f1;
  --gold:#fbbf24;
  --ok:#34d399;
}

*{
  box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
}

html,
body{
  margin:0;
  max-width:100%;
  overflow-x:hidden;
}

body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--text);
  background:
    radial-gradient(900px 500px at 10% -10%,rgba(99,102,241,.28),transparent 60%),
    radial-gradient(800px 500px at 100% 0%,rgba(139,92,246,.22),transparent 60%),
    var(--bg);
  background-attachment:fixed;
  padding:20px 16px 48px;
  line-height:1.4;
}

.container{
  max-width:760px;
  margin:0 auto;
}

/* HEADER */

.header{
  display:flex;
  align-items:center;
  gap:18px;
  margin-bottom:24px;
  animation:fadeUp .5s ease both;
}

.logo{
  position:relative;
  flex:0 0 auto;
  width:92px;
  height:96px;
}

.crown{
  position:absolute;
  top:0;
  left:50%;
  width:38px;
  height:26px;
  margin-left:-19px;
  z-index:3;
  filter:drop-shadow(0 2px 6px rgba(251,191,36,.55));
}

.antenna{
  position:absolute;
  top:22px;
  width:2px;
  height:16px;
  background:#c4b5fd;
  border-radius:2px;
  z-index:1;
}

.antenna.a1{
  left:34px;
  transform:rotate(-28deg);
}

.antenna.a2{
  right:34px;
  transform:rotate(28deg);
}

.tv{
  position:absolute;
  left:0;
  right:0;
  top:30px;
  height:58px;
  border-radius:14px;
  background:linear-gradient(145deg,#7c5cf0,#4338ca);
  box-shadow:0 8px 22px rgba(99,102,241,.45),inset 0 1px 0 rgba(255,255,255,.35);
  display:flex;
  align-items:center;
  padding:6px;
  gap:5px;
  z-index:2;
}

.screen{
  flex:1;
  height:100%;
  border-radius:9px;
  background:radial-gradient(circle at 30% 20%,#2a2f6b,#0c1030);
  box-shadow:inset 0 0 0 2px rgba(0,0,0,.45),inset 0 0 14px rgba(139,92,246,.45);
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  font-weight:900;
  font-size:11px;
  line-height:1.05;
  letter-spacing:1px;
  color:#fff;
  text-shadow:0 0 8px rgba(167,139,250,.9);
}

.knobs{
  display:flex;
  flex-direction:column;
  gap:6px;
  width:10px;
}

.knobs i{
  display:block;
  width:10px;
  height:10px;
  border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fde68a,#d97706);
}

.leg{
  position:absolute;
  bottom:4px;
  width:8px;
  height:8px;
  border-radius:2px;
  background:#4338ca;
  z-index:1;
}

.leg.l1{ left:16px; }
.leg.l2{ right:16px; }

.headText{
  min-width:0;
}

.badge{
  display:inline-block;
  font-size:11px;
  font-weight:700;
  letter-spacing:.6px;
  text-transform:uppercase;
  color:#c4b5fd;
  background:rgba(139,92,246,.16);
  border:1px solid rgba(139,92,246,.4);
  padding:3px 10px;
  border-radius:999px;
}

h1{
  margin:8px 0 4px;
  font-size:34px;
  line-height:1.1;
  letter-spacing:-.5px;
}

.subtitle{
  color:var(--muted);
  font-size:15px;
}

/* CARDS */

.section{
  background:var(--card);
  border:1px solid var(--card-border);
  border-radius:20px;
  padding:18px;
  margin-bottom:16px;
  backdrop-filter:blur(6px);
  animation:fadeUp .5s ease both;
}

.cardHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:4px;
}

h2{
  margin:0;
  font-size:19px;
  letter-spacing:-.2px;
}

.cardSub{
  color:var(--muted);
  font-size:14px;
  margin:2px 0 14px;
}

.count{
  font-size:12px;
  font-weight:700;
  color:#c4b5fd;
  background:rgba(139,92,246,.16);
  padding:3px 10px;
  border-radius:999px;
}

/* BUTTONS */

button{
  font-family:inherit;
  font-size:16px;
  border:0;
  cursor:pointer;
  min-height:44px;
  padding:0 18px;
  border-radius:12px;
  color:#fff;
  transition:transform .15s ease,filter .15s ease,background .15s ease;
}

button:active{
  transform:scale(.97);
}

.btnPrimary,
.searchButton,
.addButton{
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  font-weight:700;
  box-shadow:0 6px 18px rgba(99,102,241,.35);
}

.btnPrimary:hover,
.searchButton:hover,
.addButton:hover{
  filter:brightness(1.12);
}

.btnGhost{
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.12);
  font-weight:600;
}

.btnGhost:hover{
  background:rgba(255,255,255,.14);
}

/* SEARCH */

.searchRow{
  display:flex;
  gap:8px;
}

.searchBox{
  position:relative;
  flex:1;
  min-width:0;
}

.searchBox svg{
  position:absolute;
  left:14px;
  top:50%;
  width:20px;
  height:20px;
  margin-top:-10px;
  stroke:var(--muted);
  pointer-events:none;
}

.searchBox input{
  width:100%;
  height:48px;
  padding:0 14px 0 44px;
  font-size:16px;
  font-family:inherit;
  color:var(--text);
  background:rgba(8,10,28,.7);
  border:1px solid rgba(255,255,255,.12);
  border-radius:14px;
  outline:none;
  transition:border-color .15s ease,box-shadow .15s ease;
}

.searchBox input::placeholder{
  color:#6f7599;
}

.searchBox input:focus{
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(139,92,246,.25);
}

.searchButton{
  height:48px;
  flex:0 0 auto;
}

.status{
  color:var(--muted);
  font-size:14px;
  margin-top:10px;
  min-height:0;
}

.status:empty{
  display:none;
}

.results{
  margin-top:12px;
}

.result{
  display:flex;
  align-items:center;
  gap:12px;
  background:rgba(8,10,28,.55);
  border:1px solid rgba(255,255,255,.06);
  padding:10px;
  margin-bottom:8px;
  border-radius:14px;
  animation:fadeUp .3s ease both;
}

.result img,
.result .noPoster{
  width:46px;
  height:68px;
  flex:0 0 auto;
  object-fit:cover;
  border-radius:8px;
  background:linear-gradient(145deg,#2a2f6b,#161a40);
}

.resultInfo{
  flex:1;
  min-width:0;
}

.resultName{
  font-weight:700;
  overflow:hidden;
  text-overflow:ellipsis;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}

.resultYear{
  color:var(--muted);
  font-size:13px;
}

.addButton{
  min-width:68px;
  padding:0 14px;
}

.addButton.done{
  background:rgba(52,211,153,.18);
  color:var(--ok);
  box-shadow:none;
}

/* POSTERS */

.posterGrid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(104px,1fr));
  gap:14px 12px;
}

.poster{
  min-width:0;
  animation:pop .3s ease both;
}

.posterArt{
  position:relative;
  aspect-ratio:2/3;
  border-radius:14px;
  overflow:hidden;
  background:linear-gradient(145deg,#3b3f9e,#161a40);
  box-shadow:0 8px 20px rgba(0,0,0,.4);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:34px;
  font-weight:800;
  color:rgba(255,255,255,.55);
  transition:transform .2s ease,box-shadow .2s ease;
}

.poster:hover .posterArt{
  transform:translateY(-3px);
  box-shadow:0 12px 26px rgba(99,102,241,.4);
}

.posterArt img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
}

.posterX{
  position:absolute;
  top:6px;
  right:6px;
  z-index:2;
  width:34px;
  height:34px;
  min-height:0;
  padding:0;
  border-radius:50%;
  background:rgba(10,13,30,.82);
  border:1px solid rgba(255,255,255,.25);
  font-size:18px;
  line-height:1;
  display:flex;
  align-items:center;
  justify-content:center;
}

.posterX:hover{
  background:#ef4444;
}

.posterName{
  margin-top:7px;
  font-size:13px;
  font-weight:600;
  text-align:center;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  word-break:break-word;
}

.empty{
  color:var(--muted);
  text-align:center;
  padding:26px 12px;
  border:1px dashed rgba(255,255,255,.18);
  border-radius:14px;
  font-size:14px;
}

/* TOGGLES */

.switchRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  min-height:52px;
  padding:8px 0;
  border-bottom:1px solid rgba(255,255,255,.07);
  cursor:pointer;
}

.switchRow:last-child{
  border-bottom:0;
}

.switchRow span{
  font-size:16px;
  font-weight:600;
}

input.toggle{
  -webkit-appearance:none;
  appearance:none;
  position:relative;
  flex:0 0 auto;
  width:50px;
  height:30px;
  margin:0;
  border-radius:999px;
  background:rgba(255,255,255,.14);
  cursor:pointer;
  transition:background .2s ease;
}

input.toggle::after{
  content:"";
  position:absolute;
  top:3px;
  left:3px;
  width:24px;
  height:24px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 2px 5px rgba(0,0,0,.4);
  transition:transform .2s ease;
}

input.toggle:checked{
  background:linear-gradient(135deg,var(--accent),var(--accent2));
}

input.toggle:checked::after{
  transform:translateX(20px);
}

input.toggle:focus-visible{
  outline:2px solid #c4b5fd;
  outline-offset:2px;
}

/* SORT */

.sortSelect{
  position:absolute;
  width:1px;
  height:1px;
  opacity:0;
  pointer-events:none;
}

.sortGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}

.sortChip{
  text-align:left;
  min-height:62px;
  padding:10px 14px;
  background:rgba(8,10,28,.55);
  border:1px solid rgba(255,255,255,.1);
  border-radius:14px;
}

.sortChip b{
  display:block;
  font-size:15px;
}

.sortChip small{
  display:block;
  color:var(--muted);
  font-size:12px;
  margin-top:2px;
}

.sortChip:hover{
  border-color:rgba(139,92,246,.6);
}

.sortChip.active{
  background:rgba(139,92,246,.2);
  border-color:var(--accent);
  box-shadow:0 0 0 1px var(--accent) inset;
}

/* YOUR ADDON */

.addonCard{
  background:linear-gradient(145deg,rgba(139,92,246,.22),rgba(99,102,241,.1));
  border:1px solid rgba(139,92,246,.5);
  box-shadow:0 12px 36px rgba(99,102,241,.22);
}

.urlBox{
  word-break:break-all;
  font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:13px;
  color:#d6d9ff;
  background:rgba(6,8,22,.75);
  border:1px solid rgba(255,255,255,.1);
  border-radius:12px;
  padding:12px;
  margin:4px 0 12px;
}

.urlBox.placeholder{
  color:#6f7599;
  font-family:inherit;
}

.btnRow{
  display:flex;
  gap:10px;
}

.btnRow button{
  flex:1;
  min-height:50px;
}

.btnRow .btnGhost{
  flex:0 0 32%;
}

.toast{
  color:var(--ok);
  font-size:14px;
  margin-top:10px;
  min-height:18px;
}

/* ABOUT */

.twoCol{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:16px;
}

.twoCol .section{
  margin-bottom:0;
}

.twoCol{
  margin-bottom:16px;
}

.kv{
  display:flex;
  gap:10px;
  padding:7px 0;
  font-size:14px;
  border-bottom:1px solid rgba(255,255,255,.06);
}

.kv:last-of-type{
  border-bottom:0;
}

.kv b{
  flex:0 0 84px;
  color:var(--muted);
  font-weight:600;
}

.kv span{
  min-width:0;
}

.tips{
  margin:0;
  padding-left:20px;
  font-size:14px;
  color:#d2d5f2;
}

.tips li{
  margin:6px 0;
}

.footer{
  text-align:center;
  color:#5f658c;
  font-size:12px;
  margin-top:20px;
}

@keyframes fadeUp{
  from{ opacity:0; transform:translateY(10px); }
  to{ opacity:1; transform:none; }
}

@keyframes pop{
  from{ opacity:0; transform:scale(.92); }
  to{ opacity:1; transform:none; }
}

@media (prefers-reduced-motion:reduce){
  *{
    animation:none !important;
    transition:none !important;
  }
}

@media (max-width:640px){
  .twoCol{
    grid-template-columns:1fr;
  }
}

@media (max-width:480px){
  body{
    padding:16px 12px 40px;
  }
  .header{
    gap:14px;
  }
  .logo{
    transform:scale(.88);
    transform-origin:left center;
    margin-right:-10px;
  }
  h1{
    font-size:28px;
  }
  .subtitle{
    font-size:14px;
  }
  .section{
    padding:16px 14px;
    border-radius:18px;
  }
  .posterGrid{
    grid-template-columns:repeat(3,1fr);
    gap:12px 10px;
  }
  .searchButton{
    padding:0 14px;
  }
  .btnRow{
    flex-direction:column;
  }
  .btnRow .btnGhost{
    flex:1;
  }
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<div class="logo" aria-hidden="true">

<svg class="crown" viewBox="0 0 38 26">
<path d="M3 22 L1 6 L11 14 L19 2 L27 14 L37 6 L35 22 Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="1.5" cy="6" r="2.2" fill="#fde68a"/>
<circle cx="19" cy="2.5" r="2.2" fill="#fde68a"/>
<circle cx="36.5" cy="6" r="2.2" fill="#fde68a"/>
</svg>

<div class="antenna a1"></div>
<div class="antenna a2"></div>

<div class="tv">
<div class="screen">MY<br>SHOWS</div>
<div class="knobs"><i></i><i></i></div>
</div>

<div class="leg l1"></div>
<div class="leg l2"></div>

</div>

<div class="headText">

<span class="badge">
Stremio Addon
</span>

<h1>
My Shows
</h1>

<div class="subtitle">
Track upcoming episodes and add shows you're watching.
</div>

</div>

</div>

<div class="section">

<div class="cardHead">
<h2>
Search &amp; Add Shows
</h2>
</div>

<div class="cardSub">
Find a show on TMDB and add it to your list.
</div>

<div class="searchRow">

<div class="searchBox">

<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="11" cy="11" r="7"></circle>
<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>

<input
  id="searchInput"
  type="text"
  placeholder="Search TV shows..."
  autocomplete="off"
  enterkeyhint="search"
/>

</div>

<button
  class="searchButton"
  type="button"
  onclick="searchShows()"
>
Search
</button>

</div>

<div
  id="searchStatus"
  class="status"
></div>

<div
  id="results"
  class="results"
></div>

</div>

<div class="section">

<div class="cardHead">
<h2>
My Shows
</h2>
<span id="showCount" class="count">0</span>
</div>

<div class="cardSub">
Tap the X on a poster to remove a show.
</div>

<div
  id="selected"
></div>

</div>

<div class="section">

<h2>
Home Rows
</h2>

<div class="cardSub">
Choose which sections appear on your Stremio home page.
</div>

<label class="switchRow">

<span>
My Shows
</span>

<input
  type="checkbox"
  class="toggle"
  id="row-myshows"
/>

</label>

<label class="switchRow">

<span>
What's Next?
</span>

<input
  type="checkbox"
  class="toggle"
  id="row-whatsnext"
/>

</label>

<label class="switchRow">

<span>
Airing This Week
</span>

<input
  type="checkbox"
  class="toggle"
  id="row-airingthisweek"
/>

</label>

<label class="switchRow">

<span>
Recently Aired
</span>

<input
  type="checkbox"
  class="toggle"
  id="row-recentlyaired"
/>

</label>

<label class="switchRow">

<span>
Returning Soon
</span>

<input
  type="checkbox"
  class="toggle"
  id="row-returningsoon"
/>

</label>

</div>

<div class="section">

<h2>
My Shows Sort
</h2>

<div class="cardSub">
Choose how shows are ordered in your My Shows row.
</div>

<select
  id="sortSelect"
  class="sortSelect"
  aria-label="My Shows sort"
>

<option value="myorder">
My Order
</option>

<option value="nextepisode">
Next Episode
</option>

<option value="recentlyaired">
Recently Aired
</option>

<option value="alphabetical">
Alphabetical
</option>

</select>

<div class="sortGrid">

<button type="button" class="sortChip" data-sort="myorder" onclick="setSort('myorder')">
<b>My Order</b><small>The order you added them</small>
</button>

<button type="button" class="sortChip" data-sort="nextepisode" onclick="setSort('nextepisode')">
<b>Next Episode</b><small>Soonest episode first</small>
</button>

<button type="button" class="sortChip" data-sort="recentlyaired" onclick="setSort('recentlyaired')">
<b>Recently Aired</b><small>Latest episode first</small>
</button>

<button type="button" class="sortChip" data-sort="alphabetical" onclick="setSort('alphabetical')">
<b>Alphabetical</b><small>A to Z</small>
</button>

</div>

</div>

<div class="twoCol">

<div class="section">

<h2>
About This Addon
</h2>

<div class="cardSub">
&nbsp;
</div>

<div class="kv"><b>Name</b><span>My Shows</span></div>
<div class="kv"><b>Type</b><span>Series</span></div>
<div class="kv"><b>Author</b><span>Nick</span></div>
<div class="kv"><b>Description</b><span>Track upcoming episodes and add shows you're watching.</span></div>

</div>

<div class="section">

<h2>
Quick Tips
</h2>

<div class="cardSub">
&nbsp;
</div>

<ul class="tips">
<li>Add shows using Search &amp; Add Shows.</li>
<li>Remove shows with the X button.</li>
<li>Choose which Home Rows appear.</li>
<li>Change how My Shows are sorted.</li>
<li>Update the addon in Stremio after making changes.</li>
</ul>

</div>

</div>

<div class="section addonCard">

<h2>
Your Addon
</h2>

<div class="cardSub">
Your personalized addon link. It updates as you make changes.
</div>

<div
  id="installUrl"
  class="urlBox placeholder"
>
Add at least one show to generate your link.
</div>

<div class="btnRow">

<button
  class="btnGhost"
  type="button"
  onclick="copyUrl()"
>
Copy
</button>

<button
  class="btnPrimary"
  type="button"
  onclick="updateInStremio()"
>
Update / Add to Stremio
</button>

</div>

<div
  id="toast"
  class="toast"
></div>

</div>

<div class="footer">
My Shows &bull; Stremio Addon
</div>

</div>

<script>

const initialIds =
  ${JSON.stringify(
    initialIds
  )};

const initialRows =
  ${JSON.stringify(
    initialRows
  )};

const initialSort =
  ${JSON.stringify(
    initialSort
  )};

const rowNames = [
  "myshows",
  "whatsnext",
  "airingthisweek",
  "recentlyaired",
  "returningsoon"
];

let selected = [];

let lastResults = [];

function escapeHtml(
  value
){

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}

function initializeRows(){

  rowNames.forEach(
    row => {

      const checkbox =
        document.getElementById(
          "row-" + row
        );

      checkbox.checked =
        initialRows.includes(
          row
        );

      checkbox.addEventListener(
        "change",
        updatePreview
      );

    }
  );

}

function setSort(
  value
){

  document.getElementById(
    "sortSelect"
  ).value =
    value;

  document.querySelectorAll(
    ".sortChip"
  ).forEach(
    chip => {

      chip.classList.toggle(
        "active",
        chip.getAttribute(
          "data-sort"
        ) === value
      );

    }
  );

  updatePreview();

}

function initializeSort(){

  setSort(
    initialSort
  );

}

function renderSelected(){

  const box =
    document.getElementById(
      "selected"
    );

  document.getElementById(
    "showCount"
  ).textContent =
    String(
      selected.length
    );

  if(
    selected.length === 0
  ){

    box.innerHTML =
      "<div class='empty'>No shows added yet. Search above to add some.</div>";

    updatePreview();

    return;

  }

  box.innerHTML =
    "<div class='posterGrid'>" +
    selected.map(
      show =>
        "<div class='poster'>" +
          "<div class='posterArt'>" +
            escapeHtml(
              (show.name || "?")
                .trim()
                .charAt(0)
                .toUpperCase()
            ) +
            (
              show.poster
                ? "<img src='" +
                  escapeHtml(show.poster) +
                  "' alt='' loading='lazy' onerror='this.remove()'>"
                : ""
            ) +
            "<button class='posterX' type='button' aria-label='Remove " +
            escapeHtml(show.name) +
            "' onclick='removeShow(" +
            Number(show.id) +
            ")'>&times;</button>" +
          "</div>" +
          "<div class='posterName'>" +
            escapeHtml(show.name) +
          "</div>" +
        "</div>"
    ).join("") +
    "</div>";

  updatePreview();

}

function removeShow(
  id
){

  selected =
    selected.filter(
      show =>
        show.id !== id
    );

  renderSelected();

}

function addShow(
  id,
  name,
  poster
){

  if(
    selected.some(
      show =>
        show.id === id
    )
  ){

    return;

  }

  selected.push({
    id:id,
    name:name,
    poster:poster || ""
  });

  renderSelected();

}

function addShowFromResult(
  index,
  button
){

  const show =
    lastResults[index];

  if(!show){
    return;
  }

  addShow(
    show.id,
    show.name,
    show.poster
  );

  button.textContent =
    "Added";

  button.classList.add(
    "done"
  );

}

function loadPosters(){

  selected.forEach(
    show => {

      if(show.poster){
        return;
      }

      fetch(
        "/api/search?query=" +
        encodeURIComponent(
          show.name
        )
      )
        .then(
          response =>
            response.json()
        )
        .then(
          data => {

            const match =
              (data.results || [])
                .find(
                  item =>
                    item.id === show.id
                );

            if(
              match &&
              match.poster
            ){

              show.poster =
                match.poster;

              renderSelected();

            }

          }
        )
        .catch(
          () => {}
        );

    }
  );

}

async function searchShows(){

  const input =
    document.getElementById(
      "searchInput"
    );

  const query =
    input.value.trim();

  const resultsBox =
    document.getElementById(
      "results"
    );

  const status =
    document.getElementById(
      "searchStatus"
    );

  if(!query){

    status.textContent =
      "Enter a show name.";

    resultsBox.innerHTML =
      "";

    return;

  }

  status.textContent =
    "Searching...";

  resultsBox.innerHTML =
    "";

  try{

    const response =
      await fetch(
        "/api/search?query=" +
        encodeURIComponent(
          query
        )
      );

    const data =
      await response.json();

    status.textContent =
      "";

    if(
      !data.results ||
      data.results.length === 0
    ){

      lastResults =
        [];

      resultsBox.innerHTML =
        "<div class='empty'>No shows found.</div>";

      return;

    }

    lastResults =
      data.results;

    resultsBox.innerHTML =
      data.results.map(
        (show, index) =>
          "<div class='result'>" +

            (
              show.poster
                ? "<img src='" +
                  escapeHtml(show.poster) +
                  "' alt=''>"
                : "<div class='noPoster'></div>"
            ) +

            "<div class='resultInfo'>" +

              "<div class='resultName'>" +
                escapeHtml(show.name) +
              "</div>" +

              "<div class='resultYear'>" +
                escapeHtml(show.year || "") +
              "</div>" +

            "</div>" +

            "<button class='addButton' type='button' onclick='addShowFromResult(" +
              index +
              ", this)'>Add</button>" +

          "</div>"
      ).join("");

  }catch(error){

    console.error(
      error
    );

    status.textContent =
      "Search failed.";

  }

}

function buildInstall(
  silent
){

  if(
    selected.length === 0
  ){

    if(!silent){

      alert(
        "Add at least one show first."
      );

    }

    return null;

  }

  const rows = [];

  rowNames.forEach(
    row => {

      const checkbox =
        document.getElementById(
          "row-" + row
        );

      if(
        checkbox.checked
      ){

        rows.push(
          row
        );

      }

    }
  );

  if(rows.length === 0){

    if(!silent){

      alert(
        "Choose at least one Home row."
      );

    }

    return null;

  }

  const sort =
    document.getElementById(
      "sortSelect"
    ).value;

  const ids =
    selected
      .map(
        show =>
          show.id
      )
      .join(",");

  const config =
    ids +
    "~" +
    rows.join(",") +
    "~" +
    sort;

  const manifestUrl =
    window.location.origin +
    "/" +
    config +
    "/manifest.json";

  const stremioUrl =
    "stremio://" +
    manifestUrl.substring(
      "https://".length
    );

  return {
    manifestUrl:manifestUrl,
    stremioUrl:stremioUrl
  };

}

function showUrl(
  result
){

  const box =
    document.getElementById(
      "installUrl"
    );

  if(result){

    box.textContent =
      result.manifestUrl;

    box.classList.remove(
      "placeholder"
    );

  }else{

    box.textContent =
      "Add at least one show and one Home row to generate your link.";

    box.classList.add(
      "placeholder"
    );

  }

}

function updatePreview(){

  const result =
    buildInstall(
      true
    );

  showUrl(
    result
  );

  window.stremioInstallUrl =
    result
      ? result.stremioUrl
      : null;

}

function installAddon(){

  const result =
    buildInstall(
      false
    );

  if(!result){

    return false;

  }

  showUrl(
    result
  );

  window.stremioInstallUrl =
    result.stremioUrl;

  return true;

}

function openStremio(){

  if(
    !window.stremioInstallUrl
  ){

    return;

  }

  window.location.href =
    window.stremioInstallUrl;

}

function updateInStremio(){

  if(
    installAddon()
  ){

    openStremio();

  }

}

function setToast(
  text
){

  const toast =
    document.getElementById(
      "toast"
    );

  toast.textContent =
    text;

  setTimeout(
    () => {

      toast.textContent =
        "";

    },
    2500
  );

}

function copyUrl(){

  const result =
    buildInstall(
      false
    );

  if(!result){
    return;
  }

  const text =
    result.manifestUrl;

  function fallback(){

    const area =
      document.createElement(
        "textarea"
      );

    area.value =
      text;

    area.style.position =
      "fixed";

    area.style.opacity =
      "0";

    document.body.appendChild(
      area
    );

    area.focus();

    area.select();

    let ok = false;

    try{

      ok =
        document.execCommand(
          "copy"
        );

    }catch(error){

      ok = false;

    }

    document.body.removeChild(
      area
    );

    setToast(
      ok
        ? "Link copied!"
        : "Copy failed. Press and hold the link to copy it."
    );

  }

  if(
    navigator.clipboard &&
    navigator.clipboard.writeText
  ){

    navigator.clipboard
      .writeText(text)
      .then(
        () =>
          setToast(
            "Link copied!"
          )
      )
      .catch(
        fallback
      );

  }else{

    fallback();

  }

}

async function loadExistingShows(){

  if(
    initialIds.length === 0
  ){

    renderSelected();

    return;

  }

  try{

    const response =
      await fetch(
        "/api/shows?ids=" +
        initialIds.join(",")
      );

    const data =
      await response.json();

    if(
      data.results &&
      Array.isArray(
        data.results
      )
    ){

      selected =
        data.results.map(
          show => ({
            id:show.id,
            name:show.name,
            poster:""
          })
        );

    }

  }catch(error){

    console.error(
      "Failed to load existing shows",
      error
    );

  }

  renderSelected();

  loadPosters();

}

document.getElementById(
  "searchInput"
).addEventListener(
  "keydown",
  event => {

    if(
      event.key === "Enter"
    ){

      searchShows();

    }

  }
);

initializeRows();

initializeSort();

loadExistingShows();

</script>

</body>

</html>
  `);

}


/*
====================================================
CONFIGURE ROUTES
====================================================
*/

app.get(
  "/configure",
  async (req,res) => {

    await sendConfigure(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/configure",
  async (req,res) => {

    await sendConfigure(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
TMDB SEARCH
====================================================
*/

app.get(
  "/api/search",
  async (req,res) => {

    try{

      if(!TMDB_API_KEY){

        return res
          .status(500)
          .json({
            error:
              "TMDB_API_KEY is not configured"
          });

      }

      const query =
        String(
          req.query.query || ""
        ).trim();

      if(!query){

        return res.json({
          results:[]
        });

      }

      const response =
        await axios.get(
          tmdbUrl(
            "/search/tv"
          ),
          {
            params:{
              api_key:
                TMDB_API_KEY,
              query:
                query,
              language:
                "en-US",
              include_adult:
                false
            }
          }
        );

      const results =
        (
          response.data.results ||
          []
        )
        .slice(
          0,
          20
        )
        .map(
          show => {

            return {

              id:
                show.id,

              name:
                show.name,

              year:
                show.first_air_date
                  ? show.first_air_date.substring(
                      0,
                      4
                    )
                  : "",

              poster:
                imageUrl(
                  show.poster_path
                ),

              overview:
                show.overview ||
                ""

            };

          }
        );

      res.json({
        results:
          results
      });

    }catch(error){

      console.error(
        error.response
          ? error.response.data
          : error.message
      );

      res
        .status(500)
        .json({
          error:
            "Failed to search TV shows"
        });

    }

  }
);


/*
====================================================
LOAD SELECTED SHOWS
====================================================
*/

app.get(
  "/api/shows",
  async (req,res) => {

    try{

      if(!TMDB_API_KEY){

        return res
          .status(500)
          .json({
            error:
              "TMDB_API_KEY is not configured"
          });

      }

      const ids =
        String(
          req.query.ids || ""
        )
        .split(",")
        .map(
          id =>
            Number(
              id.trim()
            )
        )
        .filter(
          id =>
            Number.isInteger(id) &&
            id > 0
        );

      await prefetchShows(
        ids.map(id => ({ tmdbId: id }))
      );

      const results = [];

      for(
        const id of ids
      ){

        try{

          const show =
            await getShowDetails(
              id
            );

          results.push({

            id:
              show.id,

            name:
              show.name

          });

        }catch(error){

          console.error(
            "Failed to load show " +
            id,
            error.response
              ? error.response.data
              : error.message
          );

        }

      }

      res.json({
        results:
          results
      });

    }catch(error){

      console.error(
        error.response
          ? error.response.data
          : error.message
      );

      res
        .status(500)
        .json({
          error:
            "Failed to load selected shows"
        });

    }

  }
);


/*
====================================================
MANIFEST
====================================================
*/

async function sendManifest(
  req,
  res,
  config
){

  const rows =
    getRowsFromConfig(
      config
    );

  const catalogs = [];

  if(
    rows.includes(
      "myshows"
    )
  ){

    catalogs.push({

      type:"series",
      id:"myshows",
      name:"My Shows"

    });

  }

  if(
    rows.includes(
      "whatsnext"
    )
  ){

    catalogs.push({

      type:"series",
      id:"whatsnext",
      name:"What's Next?"

    });

  }

  if(
    rows.includes(
      "airingthisweek"
    )
  ){

    catalogs.push({

      type:"series",
      id:"airingthisweek",
      name:"Airing This Week"

    });

  }

  if(
    rows.includes(
      "recentlyaired"
    )
  ){

    catalogs.push({

      type:"series",
      id:"recentlyaired",
      name:"Recently Aired"

    });

  }

  if(
    rows.includes(
      "returningsoon"
    )
  ){

    catalogs.push({

      type:"series",
      id:"returningsoon",
      name:"Returning Soon"

    });

  }

  res.json({

    id:
      "com.nick1234.myshows",

    version:
      "2.5.0",

    name:
      "My Shows",

    description:
      "Track upcoming episodes and add shows you're watching.",

    resources:[
      "catalog",
      "meta"
    ],

    types:[
      "series"
    ],

    idPrefixes:[
      "tmdb:"
    ],

    behaviorHints:{
      configurable:true
    },

    catalogs:
      catalogs

  });

}

app.get(
  "/manifest.json",
  async (req,res) => {

    await sendManifest(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/manifest.json",
  async (req,res) => {

    await sendManifest(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
HELPERS
====================================================
*/

function todayUTC(){

  const today =
    new Date();

  today.setUTCHours(
    0,
    0,
    0,
    0
  );

  return today;

}

function dayDiff(
  a,
  b
){

  const first =
    new Date(
      a +
      "T00:00:00Z"
    );

  const second =
    new Date(
      b +
      "T00:00:00Z"
    );

  return Math.round(
    (
      first.getTime() -
      second.getTime()
    ) /
    86400000
  );

}

function daysUntil(
  dateString
){

  if(!dateString){
    return null;
  }

  const today =
    todayUTC();

  const target =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return Math.round(
    (
      target.getTime() -
      today.getTime()
    ) /
    86400000
  );

}

function daysSince(
  dateString
){

  if(!dateString){
    return null;
  }

  const today =
    todayUTC();

  const target =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return Math.round(
    (
      today.getTime() -
      target.getTime()
    ) /
    86400000
  );

}

function isReturningSoon(
  dateString
){

  if(!dateString){
    return false;
  }

  const today =
    todayUTC();

  const sevenDays =
    new Date(today);

  sevenDays.setUTCDate(
    sevenDays.getUTCDate() +
    7
  );

  const target =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return (
    target >
    sevenDays
  );

}


/*
====================================================
MY SHOWS
====================================================
*/

async function sendMyShows(
  req,
  res,
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  await prefetchShows(shows);

  const sort =
    getSortFromConfig(
      config
    );

  const items = [];

  for(
    let index = 0;
    index < shows.length;
    index++
  ){

    const show =
      shows[index];

    try{

      const data =
        await getShowDetails(
          show.tmdbId
        );

      let nextTime =
        null;

      let lastTime =
        null;

      if(
        data.next_episode_to_air &&
        data.next_episode_to_air.air_date
      ){

        nextTime =
          new Date(
            data
              .next_episode_to_air
              .air_date +
            "T00:00:00Z"
          ).getTime();

      }

      if(
        data.last_episode_to_air &&
        data.last_episode_to_air.air_date
      ){

        lastTime =
          new Date(
            data
              .last_episode_to_air
              .air_date +
            "T00:00:00Z"
          ).getTime();

      }

      items.push({

        data:
          data,

        nextTime:
          nextTime,

        lastTime:
          lastTime,

        originalIndex:
          index

      });

    }catch(error){

      console.error(
        "My Shows error",
        show.tmdbId,
        error.message
      );

    }

  }

  const sorted =
    sortMyShows(
      items,
      sort
    );

  const metas =
    sorted.map(
      item => {

        const data =
          item.data;

        const description =
          data.overview || "";


        return {

          id:
            "tmdb:" +
            data.id,

          type:
            "series",

          name:
            data.name,

          poster:
            imageUrl(
              data.poster_path
            ),

          background:
            imageUrl(
              data.backdrop_path,
              "original"
            ),

          description:
            description

        };

      }
    );

  res.json({
    metas:
      metas
  });

}

app.get(
  "/catalog/series/myshows.json",
  async (req,res) => {

    await sendMyShows(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/catalog/series/myshows.json",
  async (req,res) => {

    await sendMyShows(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
AIRING THIS WEEK
====================================================
*/

async function sendAiringThisWeek(
  req,
  res,
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  await prefetchShows(shows);

  const metas = [];

  for(
    const show of shows
  ){

    try{

      const data =
        await getShowDetails(
          show.tmdbId
        );

      const next =
        data.next_episode_to_air;

      if(
        !next ||
        !next.air_date ||
        !isWithinNext7Days(
          next.air_date
        )
      ){

        continue;

      }

      const episode =
        next;

      metas.push({

        id:
          "tmdb:" +
          data.id,

        type:
          "series",

        name:
          data.name,

        poster:
          imageUrl(
            data.poster_path
          ),

        background:
          imageUrl(
            data.backdrop_path,
            "original"
          ),

        description:
          "📺 S" +
          episode.season_number +
          " E" +
          episode.episode_number +
          " — " +
          (
            episode.name ||
            "Upcoming Episode"
          ) +
          " • " +
          "📅 Airs " +
          formatDate(
            episode.air_date
          )

      });

    }catch(error){

      console.error(
        "Airing This Week error",
        show.tmdbId,
        error.message
      );

    }

  }

  metas.sort(
    (a,b) => {

      const aDate =
        a.description.match(
          /Airs (.+)/
        );

      const bDate =
        b.description.match(
          /Airs (.+)/
        );

      return 0;

    }
  );

  res.json({
    metas:
      metas
  });

}

app.get(
  "/catalog/series/airingthisweek.json",
  async (req,res) => {

    await sendAiringThisWeek(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/catalog/series/airingthisweek.json",
  async (req,res) => {

    await sendAiringThisWeek(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
WHAT'S NEXT
====================================================
*/

async function sendWhatsNext(
  req,
  res,
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  await prefetchShows(shows);

  const upcoming = [];

  for(
    const show of shows
  ){

    try{

      const data =
        await getShowDetails(
          show.tmdbId
        );

      if(
        !data.next_episode_to_air ||
        !data.next_episode_to_air.air_date
      ){

        continue;

      }

      const nextEpisode =
        data.next_episode_to_air;

      const airDate =
        new Date(
          nextEpisode.air_date +
          "T00:00:00Z"
        );

      upcoming.push({

        data:
          data,

        episode:
          nextEpisode,

        airTime:
          airDate.getTime()

      });

    }catch(error){

      console.error(
        "Failed to find next episode for TMDB " +
        show.tmdbId,
        error.response
          ? error.response.data
          : error.message
      );

    }

  }

  upcoming.sort(
    (a,b) =>
      a.airTime -
      b.airTime
  );

  res.json({

    metas:
      upcoming.map(
        item => {

          const data =
            item.data;

          const next =
            item.episode;

          return {

            id:
              "tmdb:" +
              data.id,

            type:
              "series",

            name:
              data.name +
              " — S" +
              next.season_number +
              " E" +
              next.episode_number,

            poster:
              imageUrl(
                data.poster_path
              ),

            background:
              imageUrl(
                data.backdrop_path,
                "w1280"
              ),

            description:
              "⏭️ Next episode: S" +
              next.season_number +
              " E" +
              next.episode_number +
              " — " +
              (
                next.name ||
                "Upcoming Episode"
              ) +
              " • " +
              formatDate(
                next.air_date
              )

          };

        }
      )

  });

}

app.get(
  "/catalog/series/whatsnext.json",
  async (req,res) => {

    await sendWhatsNext(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/catalog/series/whatsnext.json",
  async (req,res) => {

    await sendWhatsNext(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
RECENTLY AIRED
====================================================
*/

function isRecentlyAired(
  dateString
){

  if(!dateString){
    return false;
  }

  const today =
    new Date();

  today.setUTCHours(
    0,
    0,
    0,
    0
  );

  const sevenDaysAgo =
    new Date(today);

  sevenDaysAgo.setUTCDate(
    sevenDaysAgo.getUTCDate() -
    7
  );

  const target =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return (
    target >= sevenDaysAgo &&
    target <= today
  );

}

async function sendRecentlyAired(
  req,
  res,
  config
){

  try{

    if(
      !getRowsFromConfig(
        config
      ).includes(
        "recentlyaired"
      )
    ){

      return res.json({
        metas:[]
      });

    }

    const shows =
      getShowsFromConfig(
        config
      );

    await prefetchShows(shows);

    const metas = [];

    for(
      const show of shows
    ){

      try{

        const data =
          await getShowDetails(
            show.tmdbId
          );

        if(
          !data.last_episode_to_air ||
          !data.last_episode_to_air.air_date
        ){

          continue;

        }

        const airDate =
          data
            .last_episode_to_air
            .air_date;

        const days =
          daysSince(
            airDate
          );

        if(
          days === null ||
          days < 0 ||
          days > 7
        ){

          continue;

        }

        const episode =
          data.last_episode_to_air;

        let relativeText =
          "Aired " +
          days +
          " days ago";

        if(days === 0){

          relativeText =
            "Aired today";

        }else if(
          days === 1
        ){

          relativeText =
            "Aired yesterday";

        }

        metas.push({

          id:
            "tmdb:" +
            data.id,

          type:
            "series",

          name:
            data.name,

          poster:
            imageUrl(
              data.poster_path
            ),

          background:
            imageUrl(
              data.backdrop_path,
              "original"
            ),

          description:
            "🆕 S" +
            episode.season_number +
            " E" +
            episode.episode_number +
            " — " +
            (
              episode.name ||
              "Latest Episode"
            ) +
            " • " +
            "📅 " +
            relativeText

        });

      }catch(error){

        console.error(
          "Recently Aired error",
          show.tmdbId,
          error.message
        );

      }

    }

    res.json({
      metas:
        metas
    });

  }catch(error){

    console.error(
      "Recently Aired error",
      error.message
    );

    res.status(500).json({
      error:
        "Failed to load Recently Aired"
    });

  }

}

app.get(
  "/catalog/series/recentlyaired.json",
  async (req,res) => {

    await sendRecentlyAired(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/catalog/series/recentlyaired.json",
  async (req,res) => {

    await sendRecentlyAired(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
RETURNING SOON
====================================================
*/

async function sendReturningSoon(
  req,
  res,
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  await prefetchShows(shows);

  const metas = [];

  for(
    const show of shows
  ){

    try{

      const data =
        await getShowDetails(
          show.tmdbId
        );

      if(
        !data.next_episode_to_air ||
        !data.next_episode_to_air.air_date
      ){

        continue;

      }

      const episode =
        data.next_episode_to_air;

      const airDate =
        episode.air_date;

      if(
        !isReturningSoon(
          airDate
        )
      ){

        continue;

      }

      const days =
        daysUntil(
          airDate
        );

      metas.push({

        id:
          "tmdb:" +
          data.id,

        type:
          "series",

        name:
          data.name,

        poster:
          imageUrl(
            data.poster_path
          ),

        background:
          imageUrl(
            data.backdrop_path,
            "original"
          ),

        description:
          "🔄 Returning " +
          formatDate(
            airDate
          ) +
          " • " +
          "Season " +
          episode.season_number +
          " • Episode " +
          episode.episode_number +
          ": " +
          (
            episode.name ||
            "Upcoming Episode"
          ) +
          " • " +
          "📅 In " +
          days +
          " days"

      });

    }catch(error){

      console.error(
        "Returning Soon error",
        show.tmdbId,
        error.message
      );

    }

  }

  res.json({
    metas:
      metas
  });

}

app.get(
  "/catalog/series/returningsoon.json",
  async (req,res) => {

    await sendReturningSoon(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/catalog/series/returningsoon.json",
  async (req,res) => {

    await sendReturningSoon(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
PERSONALIZED CATALOG ROUTES
====================================================
*/

app.get(
  "/:config/catalog/series/myshows.json",
  async (req,res) => {

    await sendMyShows(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/whatsnext.json",
  async (req,res) => {

    await sendWhatsNext(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/airingthisweek.json",
  async (req,res) => {

    await sendAiringThisWeek(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/recentlyaired.json",
  async (req,res) => {

    await sendRecentlyAired(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/returningsoon.json",
  async (req,res) => {

    await sendReturningSoon(
      req,
      res,
      req.params.config
    );

  }
);


/*
====================================================
GENERIC CATALOG ROUTES
====================================================
*/

app.get(
  "/catalog/series/myshows.json",
  async (req,res) => {

    await sendMyShows(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/whatsnext.json",
  async (req,res) => {

    await sendWhatsNext(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/airingthisweek.json",
  async (req,res) => {

    await sendAiringThisWeek(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/recentlyaired.json",
  async (req,res) => {

    await sendRecentlyAired(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/returningsoon.json",
  async (req,res) => {

    await sendReturningSoon(
      req,
      res,
      ""
    );

  }
);


/*
====================================================
META
====================================================
*/

async function sendMeta(
  req,
  res,
  tmdbId
){

  try{

    const data =
      await getShowDetails(
        tmdbId
      );

    let seasonNumber = null;

    if(data.next_episode_to_air){

      seasonNumber =
        data.next_episode_to_air.season_number;

    }else if(data.last_episode_to_air){

      seasonNumber =
        data.last_episode_to_air.season_number;

    }else if(data.number_of_seasons){

      seasonNumber =
        data.number_of_seasons;

    }

    // Fetch EVERY season from TMDB, processed in ascending season order.
    // Episode order within each season is left exactly as TMDB returns it.
    const seasonList =
      (data.seasons || [])
        .filter(
          season =>
            season.season_number >= 0
        )
        .sort(
          (a,b) =>
            a.season_number -
            b.season_number
        );

    await mapLimit(
      seasonList,
      6,
      season =>
        getSeasonEpisodes(
          tmdbId,
          season.season_number
        ).catch(() => null)
    );

    let episodes = [];

    for(const season of seasonList){

      try{

        const seasonEpisodes =
          await getSeasonEpisodes(
            tmdbId,
            season.season_number
          );

        episodes =
          episodes.concat(
            seasonEpisodes
          );

      }catch(error){

        console.error(
          "Season error",
          tmdbId,
          season.season_number,
          error.message
        );

      }

    }

    const videos =
      episodes.map(
        episode => {

          return {

            id:
              "tmdb:" +
              tmdbId +
              ":" +
              episode.season_number +
              ":" +
              episode.episode_number,

            title:
              "S" +
              episode.season_number +
              " E" +
              episode.episode_number +
              " - " +
              episode.name,

            released:
              episode.air_date
                ? episode.air_date +
                  "T12:00:00.000Z"
                : "2099-12-31T00:00:00.000Z",

            thumbnail:
              imageUrl(
                episode.still_path,
                "w300"
              ),

            season:
              episode.season_number,

            episode:
              episode.episode_number,

            overview:
              episode.overview || ""

          };

        }
      );

    let statusText = "";

    if(
      data.status === "Ended"
    ){

      statusText =
        "🔴 Ended";

    }else if(
      data.status === "Canceled"
    ){

      statusText =
        "🔴 Canceled";

    }else if(
      data.next_episode_to_air
    ){

      statusText =
        "🟢 Currently Airing";

      if(
        data.next_episode_to_air.air_date
      ){

        statusText +=
          " • 📅 Next episode: " +
          formatDate(
            data
              .next_episode_to_air
              .air_date
          );

      }

    }else if(
      data.status === "Returning Series"
    ){

      statusText =
        "🔵 Returning Series";

    }else if(
      data.status === "In Production"
    ){

      statusText =
        "🟡 In Production";

    }else if(
      data.status === "Planned"
    ){

      statusText =
        "⚪ Planned";

    }


    /*
    ==================================================
    SEASON-AWARE AIRING PROGRESS
    ==================================================
    */

    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0
    );

    const airedEpisodes =
      episodes.filter(
        episode =>
          episode.air_date &&
          new Date(
            episode.air_date +
            "T00:00:00Z"
          ) <= today
      );

    let progressSeasonNumber =
      null;

    if(
      data.next_episode_to_air
    ){

      progressSeasonNumber =
        data
          .next_episode_to_air
          .season_number;

    }else if(
      airedEpisodes.length > 0
    ){

      progressSeasonNumber =
        Math.max(
          ...airedEpisodes.map(
            episode =>
              episode.season_number
          )
        );

    }else if(
      seasonNumber !== null
    ){

      progressSeasonNumber =
        seasonNumber;

    }

    let progressText = "";

    if(
      progressSeasonNumber !== null
    ){

      const seasonEpisodes =
        episodes.filter(
          episode =>
            episode.season_number ===
            progressSeasonNumber
        );

      const seasonAiredEpisodes =
        seasonEpisodes.filter(
          episode =>
            episode.air_date &&
            new Date(
              episode.air_date +
              "T00:00:00Z"
            ) <= today
        );

      if(
        seasonEpisodes.length > 0
      ){

        progressText =
          "📊 Season " +
          progressSeasonNumber +
          " — " +
          seasonAiredEpisodes.length +
          " of " +
          seasonEpisodes.length +
          " episodes aired";

      }

    }

    const overview =
      data.overview ||
      "";

    const detailsParts = [];

    if(statusText){

      detailsParts.push(
        statusText
      );

    }

    if(progressText){

      detailsParts.push(
        progressText
      );

    }

    if(overview){

      detailsParts.push(
        overview
      );

    }

    returnMeta(
      res,
      {

        id:
          "tmdb:" +
          data.id,

        type:
          "series",

        name:
          data.name,

        poster:
          imageUrl(
            data.poster_path
          ),

        background:
          imageUrl(
            data.backdrop_path,
            "original"
          ),

        description:
          detailsParts.join(
            " • "
          ),

        releaseInfo:
          data.first_air_date
            ? data.first_air_date.substring(
                0,
                4
              ) +
              "-"
            : undefined,

        videos:
          videos

      }
    );

  }catch(error){

    console.error(
      "Meta error",
      tmdbId,
      error.response
        ? error.response.data
        : error.message
    );

    res.status(500).json({
      error:
        "Failed to load show information"
    });

  }

}

function cleanText(value){
  if(typeof value !== "string"){
    return value;
  }
  return value
    .replace(/\\+n/g, " • ")
    .replace(/\/n/g, " • ")
    .replace(/[\r\n]+/g, " • ")
    .replace(/(\s*•\s*){2,}/g, " • ");
}

function returnMeta(
  res,
  meta
){

  if(meta && typeof meta.description === "string"){
    meta.description = cleanText(meta.description);
  }

  res.json({
    meta:
      meta
  });

}


/*
====================================================
META ROUTES
====================================================
*/

app.get(
  "/meta/series/:id.json",
  async (req,res) => {

    const id =
      String(req.params.id || "");

    const tmdbId =
      id.startsWith("tmdb:")
        ? id.substring(5)
        : id;

    await sendMeta(
      req,
      res,
      tmdbId
    );

  }
);

app.get(
  "/:config/meta/series/:id.json",
  async (req,res) => {

    const id =
      String(req.params.id || "");

    const tmdbId =
      id.startsWith("tmdb:")
        ? id.substring(5)
        : id;

    await sendMeta(
      req,
      res,
      tmdbId
    );

  }
);


/*
====================================================
START SERVER
====================================================
*/

app.listen(
  PORT,
  () => {

    console.log(
      "My Shows addon running on port " +
      PORT
    );

  }
);