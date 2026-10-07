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

async function getShowDetails(
  tmdbId
){

  const response =
    await axios.get(
      tmdbUrl(
        "/tv/" +
        tmdbId
      ),
      {
        params:{
          api_key:
            TMDB_API_KEY
        }
      }
    );

  return response.data;

}

async function getSeasonEpisodes(
  tmdbId,
  seasonNumber
){

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
<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>

<title>
My Shows Configure
</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111;
  color:#fff;
  margin:0;
  padding:16px;
}

.container{
  max-width:800px;
  margin:auto;
}

h1{
  margin-bottom:6px;
}

.subtitle{
  color:#aaa;
  margin-bottom:20px;
}

.section{
  background:#1b1b1b;
  border-radius:12px;
  padding:16px;
  margin-bottom:16px;
}

input,
select,
button{
  font-size:16px;
}

.searchRow{
  display:flex;
  gap:8px;
}

.searchRow input{
  flex:1;
  padding:12px;
  border-radius:8px;
  border:1px solid #444;
  background:#222;
  color:#fff;
}

button{
  padding:11px 14px;
  border:0;
  border-radius:8px;
  cursor:pointer;
}

.searchButton{
  background:#fff;
  color:#111;
}

.results{
  margin-top:12px;
}

.result{
  display:flex;
  align-items:center;
  gap:12px;
  background:#222;
  padding:10px;
  margin-bottom:8px;
  border-radius:8px;
}

.result img{
  width:55px;
  height:80px;
  object-fit:cover;
  border-radius:6px;
}

.resultInfo{
  flex:1;
}

.resultName{
  font-weight:bold;
}

.resultYear{
  color:#aaa;
  font-size:13px;
}

.addButton{
  background:#fff;
  color:#111;
}

.selectedItem{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  padding:10px;
  background:#222;
  border-radius:8px;
  margin-bottom:8px;
}

.remove{
  background:#333;
  color:#fff;
}

.switchRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:12px 0;
  border-bottom:1px solid #333;
}

.switchRow:last-child{
  border-bottom:0;
}

.install{
  display:none;
  background:#182318;
  border:1px solid #365236;
  padding:16px;
  border-radius:10px;
}

.installUrl{
  word-break:break-all;
  color:#aaa;
  font-size:13px;
  margin:10px 0;
}

.primary{
  background:#fff;
  color:#111;
  width:100%;
  margin-top:10px;
}

.status{
  color:#aaa;
  margin-top:8px;
}

</style>

</head>

<body>

<div class="container">

<h1>
My Shows
</h1>

<div class="subtitle">
Choose the shows and Home rows you want.
</div>

<div class="section">

<h2>
Add Shows
</h2>

<div class="searchRow">

<input
  id="searchInput"
  type="text"
  placeholder="Search TV shows..."
/>

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

<h2>
My Shows
</h2>

<div
  id="selected"
></div>

</div>

<div class="section">

<h2>
Home Rows
</h2>

<div class="switchRow">

<span>
My Shows
</span>

<input
  type="checkbox"
  id="row-myshows"
/>

</div>

<div class="switchRow">

<span>
What's Next?
</span>

<input
  type="checkbox"
  id="row-whatsnext"
/>

</div>

<div class="switchRow">

<span>
Airing This Week
</span>

<input
  type="checkbox"
  id="row-airingthisweek"
/>

</div>

<div class="switchRow">

<span>
Recently Aired
</span>

<input
  type="checkbox"
  id="row-recentlyaired"
/>

</div>

<div class="switchRow">

<span>
Returning Soon
</span>

<input
  type="checkbox"
  id="row-returningsoon"
/>

</div>

</div>

<div class="section">

<h2>
My Shows Sort
</h2>

<select
  id="sortSelect"
  style="
    width:100%;
    padding:12px;
    border-radius:8px;
    background:#222;
    color:#fff;
    border:1px solid #444;
  "
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

</div>

<div class="section">

<button
  class="primary"
  type="button"
  onclick="installAddon()"
>
Install / Update Addon
</button>

</div>

<div
  id="installBox"
  class="install"
>

<h3>
Addon Ready
</h3>

<div
  id="installUrl"
  class="installUrl"
></div>

<button
  class="primary"
  type="button"
  onclick="openStremio()"
>
Open in Stremio
</button>

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

let selected = [];

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

  const rowNames = [
    "myshows",
    "whatsnext",
    "airingthisweek",
    "recentlyaired",
    "returningsoon"
  ];

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

    }
  );

}

function initializeSort(){

  document.getElementById(
    "sortSelect"
  ).value =
    initialSort;

}

function renderSelected(){

  const box =
    document.getElementById(
      "selected"
    );

  if(
    selected.length === 0
  ){

    box.innerHTML =
      "<div style='color:#888'>No shows added yet.</div>";

    return;

  }

  box.innerHTML =
    selected.map(
      show => \`
        <div class="selectedItem">

          <span>
            \${escapeHtml(show.name)}
          </span>

          <button
            class="remove"
            type="button"
            onclick="removeShow(\${show.id})"
          >
            Remove
          </button>

        </div>
      \`
    ).join("");

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
  name
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
    name:name
  });

  renderSelected();

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

      resultsBox.innerHTML =
        "<div style='color:#888'>No shows found.</div>";

      return;

    }

    resultsBox.innerHTML =
      data.results.map(
        show => \`
          <div class="result">

            <img
              src="\${show.poster || ""}"
              alt=""
            >

            <div class="resultInfo">

              <div class="resultName">
                \${escapeHtml(show.name)}
              </div>

              <div class="resultYear">
                \${escapeHtml(show.year || "")}
              </div>

            </div>

            <button
              class="addButton"
              type="button"
              onclick="addShow(\${show.id}, \${JSON.stringify(show.name)})"
            >
              Add
            </button>

          </div>
        \`
      ).join("");

  }catch(error){

    console.error(
      error
    );

    status.textContent =
      "Search failed.";

  }

}

function installAddon(){

  if(
    selected.length === 0
  ){

    alert(
      "Add at least one show first."
    );

    return;

  }

  const rows = [];

  const rowNames = [
    "myshows",
    "whatsnext",
    "airingthisweek",
    "recentlyaired",
    "returningsoon"
  ];

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

    alert(
      "Choose at least one Home row."
    );

    return;

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

  document.getElementById(
    "installUrl"
  ).textContent =
    manifestUrl;

  document.getElementById(
    "installBox"
  ).style.display =
    "block";

  window.stremioInstallUrl =
    stremioUrl;

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
            name:show.name
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

}

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
      "2.4.0",

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

    const seasons =
      (data.seasons || [])
        .filter(
          season =>
            season.season_number >= 0
        );

    seasons.sort(
      (a,b) =>
        a.season_number - b.season_number
    );

    let episodes = [];

    for(
      const season of seasons
    ){

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

    episodes.sort(
      (a,b) =>
        a.season_number - b.season_number ||
        a.episode_number - b.episode_number
    );

    const videos =
      episodes.map(
        episode => {

          return {

            id:
              "tmdb:" +
              tmdbId +
              ":s" +
              episode.season_number +
              ":e" +
              episode.episode_number,

            title:
              episode.name ||
              "Episode " +
              episode.episode_number,

            season:
              episode.season_number,

            number:
              episode.episode_number,

            overview:
              episode.overview ||
              "",

            released:
              episode.air_date
                ? new Date(
                    episode.air_date +
                    "T12:00:00Z"
                  ).toISOString()
                : undefined,

            thumbnail:
              imageUrl(
                episode.still_path,
                "w780"
              )

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
      seasons.length > 0
    ){

      progressSeasonNumber =
        seasons[
          seasons.length - 1
        ].season_number;

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