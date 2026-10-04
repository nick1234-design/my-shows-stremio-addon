const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;

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
  return "https://api.themoviedb.org/3" + path;
}

function imageUrl(path, size = "w500") {
  if (!path) return undefined;
  return "https://image.tmdb.org/t/p/" + size + path;
}

function formatDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString + "T00:00:00Z");

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function isWithinNext7Days(dateString) {
  if (!dateString) return false;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const target = new Date(dateString + "T00:00:00Z");

  const sevenDays = new Date(today);
  sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);

  return target >= today && target <= sevenDays;
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

function getShowPartFromConfig(config) {
  if (!config) return "";
  return String(config).split("~")[0];
}

function getRowsFromConfig(config) {

  if (
    !config ||
    !String(config).includes("~")
  ) {
    return DEFAULT_ROWS;
  }

  const rowPart =
    String(config).split("~")[1] || "";

  const rows =
    rowPart
      .split(",")
      .map(row => row.trim())
      .filter(row =>
        ALL_ROWS.includes(row)
      );

  return rows.length > 0
    ? rows
    : DEFAULT_ROWS;
}

function getSortFromConfig(config) {

  if (!config || !String(config).includes("~")) {
    return DEFAULT_SORT;
  }

  const parts = String(config).split("~");
  const sort = String(parts[2] || "").trim();

  return ALL_SORTS.includes(sort)
    ? sort
    : DEFAULT_SORT;
}

function sortMyShows(items, sort) {

  if (sort === "alphabetical") {
    return items.sort((a,b) =>
      a.data.name.localeCompare(b.data.name)
    );
  }

  if (sort === "nextepisode") {
    return items.sort((a,b) => {
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
    });
  }

  if (sort === "recentlyaired") {
    return items.sort((a,b) => {

      const aTime =
        a.lastTime ?? 0;

      const bTime =
        b.lastTime ?? 0;

      return (
        bTime -
        aTime ||
        a.originalIndex -
        b.originalIndex
      );

    });
  }

  return items.sort(
    (a,b) =>
      a.originalIndex -
      b.originalIndex
  );
}

function getShowsFromConfig(config) {

  if (!config) {
    return DEFAULT_SHOWS;
  }

  const showPart =
    getShowPartFromConfig(config);

  const ids =
    showPart
      .split(",")
      .map(id => id.trim())
      .filter(id => /^\d+$/.test(id));

  if (ids.length === 0) {
    return DEFAULT_SHOWS;
  }

  return ids.map(id => ({
    tmdbId: Number(id)
  }));
}

async function getShowDetails(tmdbId) {

  const response =
    await axios.get(
      tmdbUrl("/tv/" + tmdbId),
      {
        params: {
          api_key: TMDB_API_KEY
        }
      }
    );

  return response.data;
}

async function getSeasonEpisodes(
  tmdbId,
  seasonNumber
) {

  const response =
    await axios.get(
      tmdbUrl(
        "/tv/" +
        tmdbId +
        "/season/" +
        seasonNumber
      ),
      {
        params: {
          api_key: TMDB_API_KEY
        }
      }
    );

  return response.data.episodes || [];
}


/*
====================================================
HOME
====================================================
*/

app.get("/", (req, res) => {

  res.send(`
    <html>

      <head>

        <title>My Shows</title>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

      </head>

      <body style="
        font-family:Arial;
        background:#111;
        color:white;
        padding:30px;
        text-align:center;
      ">

        <h1>📺 My Shows</h1>

        <p>
          Track your favorite TV shows in Stremio.
        </p>

        <a
          href="/configure"
          style="
            display:inline-block;
            padding:14px 22px;
            background:#7c4dff;
            color:white;
            text-decoration:none;
            border-radius:10px;
            margin-top:15px;
          "
        >
          Configure My Shows
        </a>

      </body>

    </html>
  `);

});


/*
====================================================
CUSTOM CONFIGURE PAGE
====================================================
*/

async function sendConfigure(
  req,
  res,
  config
) {

  const configString =
    String(config || "");

  const initialIds =
    getShowPartFromConfig(
      configString
    )
      .split(",")
      .map(id => Number(id.trim()))
      .filter(
        id =>
          Number.isInteger(id) &&
          id > 0
      );

  const initialRows =
    getRowsFromConfig(
      configString
    );

  const initialSort =
    getSortFromConfig(
      configString
    );

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
>

<title>Configure My Shows</title>

<style>

body{
  margin:0;
  background:#101010;
  color:white;
  font-family:Arial,sans-serif
}

.container{
  max-width:700px;
  margin:auto;
  padding:25px
}

h1{
  text-align:center
}

.subtitle{
  text-align:center;
  color:#aaa
}

.searchBox{
  display:flex;
  gap:10px;
  margin-top:25px
}

input[type="text"]{
  flex:1;
  padding:14px;
  border-radius:8px;
  border:1px solid #444;
  background:#202020;
  color:white;
  font-size:16px
}

button{
  border:0;
  border-radius:8px;
  padding:12px 18px;
  background:#7c4dff;
  color:white;
  font-weight:bold;
  cursor:pointer
}

button.remove{
  background:#444
}

.results{
  margin-top:20px
}

.show{
  display:flex;
  align-items:center;
  gap:15px;
  background:#1c1c1c;
  padding:12px;
  border-radius:10px;
  margin-bottom:10px
}

.show img{
  width:65px;
  height:95px;
  object-fit:cover;
  border-radius:6px
}

.showInfo{
  flex:1
}

.showTitle{
  font-size:17px;
  font-weight:bold
}

.year{
  color:#aaa;
  margin-top:5px
}

.selected{
  margin-top:30px
}

.selectedItem{
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:#1c1c1c;
  padding:12px;
  border-radius:8px;
  margin-bottom:8px
}

.rows{
  margin-top:30px
}

.rowCard{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:15px;
  background:#1c1c1c;
  padding:15px;
  border-radius:10px;
  margin-bottom:10px
}

.rowInfo{
  flex:1
}

.rowTitle{
  font-size:16px;
  font-weight:bold
}

.rowDescription{
  color:#999;
  font-size:13px;
  margin-top:5px
}

.switch{
  position:relative;
  width:52px;
  height:30px;
  flex:none
}

.switch input{
  opacity:0;
  width:0;
  height:0
}

.slider{
  position:absolute;
  inset:0;
  background:#444;
  border-radius:30px;
  transition:.2s;
  cursor:pointer
}

.slider:before{
  content:"";
  position:absolute;
  width:22px;
  height:22px;
  left:4px;
  top:4px;
  background:white;
  border-radius:50%;
  transition:.2s
}

.switch input:checked+.slider{
  background:#7c4dff
}

.switch input:checked+.slider:before{
  transform:translateX(22px)
}

.sortBox{
  margin-top:30px;
  background:#1c1c1c;
  padding:15px;
  border-radius:10px
}

.sortTitle{
  font-size:16px;
  font-weight:bold
}

.sortDescription{
  color:#999;
  font-size:13px;
  margin-top:5px;
  margin-bottom:12px
}

.sortBox select{
  width:100%;
  padding:12px;
  border-radius:8px;
  border:1px solid #444;
  background:#202020;
  color:white;
  font-size:16px
}

.install{
  width:100%;
  margin-top:25px;
  padding:16px;
  font-size:17px;
  background:#00a86b
}

.installBox{
  margin-top:20px;
  background:#191919;
  padding:15px;
  border-radius:10px;
  display:none
}

.installUrl{
  word-break:break-all;
  color:#aaa;
  font-size:13px;
  margin-top:10px
}

.message{
  text-align:center;
  color:#aaa;
  margin-top:20px
}

</style>

</head>

<body>

<div class="container">

<h1>📺 My Shows</h1>

<p class="subtitle">
Choose your shows and decide which Home rows you want to see.
</p>

<div class="searchBox">

<input
  type="text"
  id="search"
  placeholder="Search for a TV show..."
>

<button onclick="searchShows()">
Search
</button>

</div>

<div
  id="results"
  class="results"
></div>

<div class="selected">

<h2>My Shows</h2>

<div id="selectedShows"></div>

</div>

<div class="rows">

<h2>Home Rows</h2>

<div class="rowCard">

<div class="rowInfo">

<div class="rowTitle">
My Shows
</div>

<div class="rowDescription">
Your personal show collection.
</div>

</div>

<label class="switch">

<input
  type="checkbox"
  id="row_myshows"
>

<span class="slider"></span>

</label>

</div>


<div class="rowCard">

<div class="rowInfo">

<div class="rowTitle">
What's Next?
</div>

<div class="rowDescription">
Shows with an upcoming episode.
</div>

</div>

<label class="switch">

<input
  type="checkbox"
  id="row_whatsnext"
>

<span class="slider"></span>

</label>

</div>


<div class="rowCard">

<div class="rowInfo">

<div class="rowTitle">
Airing This Week
</div>

<div class="rowDescription">
Shows airing within the next 7 days.
</div>

</div>

<label class="switch">

<input
  type="checkbox"
  id="row_airingthisweek"
>

<span class="slider"></span>

</label>

</div>


<div class="rowCard">

<div class="rowInfo">

<div class="rowTitle">
Recently Aired
</div>

<div class="rowDescription">
Shows with an episode released in the last 7 days.
</div>

</div>

<label class="switch">

<input
  type="checkbox"
  id="row_recentlyaired"
>

<span class="slider"></span>

</label>

</div>


<div class="rowCard">

<div class="rowInfo">

<div class="rowTitle">
Returning Soon
</div>

<div class="rowDescription">
Shows returning more than 7 days from now.
</div>

</div>

<label class="switch">

<input
  type="checkbox"
  id="row_returningsoon"
>

<span class="slider"></span>

</label>

</div>

</div>


<div class="sortBox">

<div class="sortTitle">
Sort My Shows
</div>

<div class="sortDescription">
Choose how your shows appear in the My Shows row.
Other smart rows keep their own date-based order.
</div>

<select id="sortOrder">

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


<button
  class="install"
  onclick="installAddon()"
>
Generate My Shows Addon
</button>


<div
  id="installBox"
  class="installBox"
>

<strong>
Your personalized addon:
</strong>

<div
  id="installUrl"
  class="installUrl"
></div>

<br>

<button onclick="openStremio()">
Open in Stremio
</button>

</div>


</div>


<script>

const initialIds =
${JSON.stringify(initialIds)};

const initialRows =
${JSON.stringify(initialRows)};

const initialSort =
${JSON.stringify(initialSort)};

let selected = [];


function applyInitialRows(){

  document.getElementById(
    "row_myshows"
  ).checked =
    initialRows.includes(
      "myshows"
    );

  document.getElementById(
    "row_whatsnext"
  ).checked =
    initialRows.includes(
      "whatsnext"
    );

  document.getElementById(
    "row_airingthisweek"
  ).checked =
    initialRows.includes(
      "airingthisweek"
    );

  document.getElementById(
    "row_recentlyaired"
  ).checked =
    initialRows.includes(
      "recentlyaired"
    );

  document.getElementById(
    "row_returningsoon"
  ).checked =
    initialRows.includes(
      "returningsoon"
    );

}


function applyInitialSort(){

  document.getElementById(
    "sortOrder"
  ).value =
    initialSort;

}


async function searchShows(){

  const query =
    document
      .getElementById("search")
      .value
      .trim();

  if(!query){
    return;
  }

  const results =
    document.getElementById(
      "results"
    );

  results.innerHTML =
    '<div class="message">Searching...</div>';


  try{

    const response =
      await fetch(
        "/api/search?query=" +
        encodeURIComponent(query)
      );

    const data =
      await response.json();


    if(
      !data.results ||
      data.results.length === 0
    ){

      results.innerHTML =
        '<div class="message">No shows found.</div>';

      return;

    }


    results.innerHTML =
      data.results
        .map(show => {

          const poster =
            show.poster ||
            "https://via.placeholder.com/65x95?text=No+Poster";

          const alreadyAdded =
            selected.some(
              item =>
                item.id === show.id
            );


          return `
            <div class="show">

              <img src="${poster}">

              <div class="showInfo">

                <div class="showTitle">
                  ${escapeHtml(show.name)}
                </div>

                <div class="year">
                  ${show.year || ""}
                </div>

              </div>

              <button
                onclick="addShow(${show.id}, '${escapeJs(show.name)}')"
                ${alreadyAdded ? "disabled" : ""}
              >
                ${alreadyAdded ? "Added" : "Add"}
              </button>

            </div>
          `;

        })
        .join("");


  }catch(error){

    results.innerHTML =
      '<div class="message">Search failed.</div>';

  }

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

  searchShows();

}


function removeShow(id){

  selected =
    selected.filter(
      show =>
        show.id !== id
    );

  renderSelected();

  searchShows();

}


function renderSelected(){

  const box =
    document.getElementById(
      "selectedShows"
    );


  if(
    selected.length === 0
  ){

    box.innerHTML =
      '<div class="message">No shows added yet.</div>';

    return;

  }


  box.innerHTML =
    selected
      .map(show => {

        return `
          <div class="selectedItem">

            <span>
              ${escapeHtml(show.name)}
            </span>

            <button
              class="remove"
              onclick="removeShow(${show.id})"
            >
              Remove
            </button>

          </div>
        `;

      })
      .join("");

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


  const ids =
    selected
      .map(show => show.id)
      .join(",");


  const rows = [];


  if(
    document.getElementById(
      "row_myshows"
    ).checked
  ){

    rows.push(
      "myshows"
    );

  }


  if(
    document.getElementById(
      "row_whatsnext"
    ).checked
  ){

    rows.push(
      "whatsnext"
    );

  }


  if(
    document.getElementById(
      "row_airingthisweek"
    ).checked
  ){

    rows.push(
      "airingthisweek"
    );

  }


  if(
    document.getElementById(
      "row_recentlyaired"
    ).checked
  ){

    rows.push(
      "recentlyaired"
    );

  }


  if(
    document.getElementById(
      "row_returningsoon"
    ).checked
  ){

    rows.push(
      "returningsoon"
    );

  }


  if(
    rows.length === 0
  ){

    alert(
      "Choose at least one Home row."
    );

    return;

  }


  const sort =
    document.getElementById(
      "sortOrder"
    ).value;


  const config =
    ids +
    "~" +
    rows.join(",") +
    "~" +
    sort;


  const base =
    window.location.origin;


  const manifestUrl =
    base +
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


function escapeHtml(text){

  return String(text)
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


function escapeJs(text){

  return String(text)
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /'/g,
      "\\'"
    )
    .replace(
      /"/g,
      "&quot;"
    );

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


applyInitialRows();

applyInitialSort();

loadExistingShows();

</script>

</body>

</html>
  `);

}


app.get(
  "/configure",
  async (req,res) => {

    await sendConfigure(
      req,
      res,
      null
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
TMDB SEARCH FOR CONFIG PAGE
====================================================
*/

app.get(
  "/api/search",
  async (req,res) => {

    try{

      if(!TMDB_API_KEY){

        return res.status(500).json({
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
          tmdbUrl("/search/tv"),
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
        (response.data.results || [])
          .slice(0,20)
          .map(show => {

            return {

              id:
                show.id,

              name:
                show.name,

              year:
                show.first_air_date
                  ? show.first_air_date.substring(0,4)
                  : "",

              poster:
                imageUrl(
                  show.poster_path
                ),

              overview:
                show.overview || ""

            };

          });


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


      res.status(500).json({
        error:
          "Failed to search TV shows"
      });

    }

  }
);


/*
====================================================
LOAD EXISTING SHOWS FOR CONFIGURE PAGE
====================================================
*/

app.get(
  "/api/shows",
  async (req,res) => {

    try{

      if(!TMDB_API_KEY){

        return res.status(500).json({
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
              id.trim()
          )
          .filter(
            id =>
              /^\d+$/.test(id)
          );


      const results = [];


      for(
        const id of ids
      ){

        try{

          const data =
            await getShowDetails(
              id
            );


          results.push({
            id:
              Number(id),

            name:
              data.name
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
        error
      );


      res.status(500).json({
        error:
          "Failed to load existing shows"
      });

    }

  }
);


/*
====================================================
MANIFEST
====================================================
*/

function buildManifest(
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  const rows =
    getRowsFromConfig(
      config
    );

  return {

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

    catalogs:
      rows.map(
        row => {

          const names = {

            myshows:
              "My Shows",

            whatsnext:
              "What's Next?",

            airingthisweek:
              "Airing This Week",

            recentlyaired:
              "Recently Aired",

            returningsoon:
              "Returning Soon"

          };

          return {

            type:
              "series",

            id:
              row,

            name:
              names[row] || row

          };

        }
      ),

    behaviorHints:{
      configurable:
        true
    }

  };

}


app.get(
  "/manifest.json",
  (req,res) => {

    res.json(
      buildManifest(
        null
      )
    );

  }
);


app.get(
  "/:config/manifest.json",
  (req,res) => {

    res.json(
      buildManifest(
        req.params.config
      )
    );

  }
);


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

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(
        config
      );


    const items = [];


    for(
      let i = 0;
      i < shows.length;
      i++
    ){

      const show =
        shows[i];


      try{

        const data =
          await getShowDetails(
            show.tmdbId
          );


        const next =
          data.next_episode_to_air;


        const last =
          data.last_episode_to_air;


        const nextTime =
          next &&
          next.air_date
            ? new Date(
                next.air_date +
                "T00:00:00Z"
              ).getTime()
            : null;


        const lastTime =
          last &&
          last.air_date
            ? new Date(
                last.air_date +
                "T00:00:00Z"
              ).getTime()
            : null;


        items.push({

          data:
            data,

          originalIndex:
            i,

          nextTime:
            nextTime,

          lastTime:
            lastTime

        });

      }catch(error){

        console.error(
          "Failed to load " +
          show.tmdbId,
          error.response
            ? error.response.data
            : error.message
        );

      }

    }


    const sort =
      getSortFromConfig(
        config
      );


    sortMyShows(
      items,
      sort
    );


    const metas =
      items.map(
        item => {

          const data =
            item.data;


          const next =
            data.next_episode_to_air;


          let description = "";


          if(next){

            description =
              "Next Episode: S" +
              next.season_number +
              " E" +
              next.episode_number +
              " — " +
              next.name +
              "\n" +
              "Airs: " +
              formatDate(
                next.air_date
              );

          }


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
                "w1280"
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


  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:
        "Failed to load My Shows"
    });

  }

}


app.get(
  "/catalog/series/myshows.json",
  async (req,res) => {

    await sendMyShows(
      req,
      res,
      null
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

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
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
          data.next_episode_to_air &&
          isWithinNext7Days(
            data.next_episode_to_air.air_date
          )
        ){

          const next =
            data.next_episode_to_air;


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
                "w1280"
              ),

            description:
              "🔥 Airs " +
              formatDate(
                next.air_date
              ) +
              "\n\n" +
              "Season " +
              next.season_number +
              ", Episode " +
              next.episode_number +
              ": " +
              next.name

          });

        }

      }catch(error){

        console.error(
          "Failed to load " +
          show.tmdbId,
          error.response
            ? error.response.data
            : error.message
        );

      }

    }


    res.json({
      metas:
        metas
    });


  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:
        "Failed to load Airing This Week"
    });

  }

}


app.get(
  "/catalog/series/airingthisweek.json",
  async (req,res) => {

    await sendAiringThisWeek(
      req,
      res,
      null
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
WHAT'S NEXT?
====================================================
*/

async function sendWhatsNext(
  req,
  res,
  config
){

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


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
          data.next_episode_to_air &&
          data.next_episode_to_air.air_date
        ){

          upcoming.push({

            data:
              data,

            episode:
              data.next_episode_to_air,

            airTime:
              new Date(
                data.next_episode_to_air.air_date +
                "T00:00:00Z"
              ).getTime()

          });

        }

      }catch(error){

        console.error(
          "Failed to load " +
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


    const metas =
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
              data.name,

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
              "⏭️ Next Episode: S" +
              next.season_number +
              " E" +
              next.episode_number +
              " — " +
              next.name +
              "\n" +
              "📅 Airs " +
              formatDate(
                next.air_date
              )

          };

        }
      );


    res.json({
      metas:
        metas
    });


  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:
        "Failed to load What's Next"
    });

  }

}


app.get(
  "/catalog/series/whatsnext.json",
  async (req,res) => {

    await sendWhatsNext(
      req,
      res,
      null
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
    sevenDaysAgo.getUTCDate() - 7
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


function daysSince(
  dateString
){

  if(!dateString){
    return null;
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


  return Math.round(
    (
      today.getTime() -
      target.getTime()
    ) /
    86400000
  );

}


async function sendRecentlyAired(
  req,
  res,
  config
){

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(
        config
      );


    const aired = [];


    for(
      const show of shows
    ){

      try{

        const data =
          await getShowDetails(
            show.tmdbId
          );


        const last =
          data.last_episode_to_air;


        if(
          last &&
          last.air_date &&
          isRecentlyAired(
            last.air_date
          )
        ){

          aired.push({

            data:
              data,

            episode:
              last,

            airTime:
              new Date(
                last.air_date +
                "T00:00:00Z"
              ).getTime()

          });

        }

      }catch(error){

        console.error(
          "Failed to load " +
          show.tmdbId,
          error.response
            ? error.response.data
            : error.message
        );

      }

    }


    aired.sort(
      (a,b) =>
        b.airTime -
        a.airTime
    );


    const metas =
      aired.map(
        item => {

          const data =
            item.data;

          const episode =
            item.episode;

          const days =
            daysSince(
              episode.air_date
            );


          let dayText =
            "📅 Aired " +
            days +
            " days ago";


          if(days === 0){

            dayText =
              "📅 Aired today";

          }else if(days === 1){

            dayText =
              "📅 Aired yesterday";

          }


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
                "w1280"
              ),

            description:
              "🆕 S" +
              episode.season_number +
              " E" +
              episode.episode_number +
              " — " +
              episode.name +
              "\n" +
              dayText

          };

        }
      );


    res.json({
      metas:
        metas
    });


  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
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
      null
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

function isReturningSoon(
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


  return target > sevenDays;

}


function daysUntil(
  dateString
){

  if(!dateString){
    return null;
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


  return Math.round(
    (
      target.getTime() -
      today.getTime()
    ) /
    86400000
  );

}


async function sendReturningSoon(
  req,
  res,
  config
){

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(
        config
      );


    const returning = [];


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
          next &&
          next.air_date &&
          isReturningSoon(
            next.air_date
          )
        ){

          returning.push({

            data:
              data,

            episode:
              next,

            airTime:
              new Date(
                next.air_date +
                "T00:00:00Z"
              ).getTime(),

            daysAway:
              daysUntil(
                next.air_date
              )

          });

        }

      }catch(error){

        console.error(
          "Failed to load " +
          show.tmdbId,
          error.response
            ? error.response.data
            : error.message
        );

      }

    }


    returning.sort(
      (a,b) =>
        a.airTime -
        b.airTime
    );


    const metas =
      returning.map(
        item => {

          const data =
            item.data;

          const next =
            item.episode;

          const days =
            item.daysAway;


          let dayText =
            "📅 In " +
            days +
            " days";


          if(days === 1){

            dayText =
              "📅 In 1 day";

          }


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
                "w1280"
              ),

            description:
              "🔄 Returning " +
              formatDate(
                next.air_date
              ) +
              "\n" +
              "Season " +
              next.season_number +
              " • Episode " +
              next.episode_number +
              ": " +
              next.name +
              "\n" +
              dayText

          };

        }
      );


    res.json({
      metas:
        metas
    });

  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );

    res.status(500).json({
      error:
        "Failed to load Returning Soon"
    });

  }

}


app.get(
  "/catalog/series/returningsoon.json",
  async (req,res) => {

    await sendReturningSoon(
      req,
      res,
      null
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
META
====================================================
*/

async function sendMeta(
  req,
  res
){

  try{

    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const id =
      req.params.id;


    if(
      !id.startsWith("tmdb:")
    ){

      return res.status(404).json({
        error:
          "Unknown show ID"
      });

    }


    const tmdbId =
      id.replace(
        "tmdb:",
        ""
      );


    const data =
      await getShowDetails(
        tmdbId
      );


    /*
    ====================================================
    LOAD ALL SEASONS AND EPISODES
    ====================================================
    */

    let episodes = [];


    const seasons =
      (data.seasons || [])
        .filter(
          season =>
            season.season_number > 0
        )
        .sort(
          (a,b) =>
            a.season_number -
            b.season_number
        );


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
          "Failed to load season " +
          season.season_number +
          " for TMDB " +
          tmdbId,
          error.response
            ? error.response.data
            : error.message
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
                : new Date().toISOString(),

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


    res.json({

      meta: {

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
            "w1280"
          ),

        description:
          (() => {

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
              data.status === "Returning Series" &&
              data.next_episode_to_air
            ){

              const next =
                data.next_episode_to_air;


              statusText =
                "🟢 Currently Airing" +
                "\n" +
                "Next Episode: S" +
                next.season_number +
                " E" +
                next.episode_number +
                " — " +
                next.name +
                "\n" +
                "Airs: " +
                formatDate(
                  next.air_date
                );

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
                data.next_episode_to_air
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
              data.overview || "";


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


            return detailsParts.join(
              "\n\n"
            );

          })(),

        releaseInfo:
          data.first_air_date
            ? data.first_air_date.substring(0,4) + "-"
            : undefined,

        videos:
          videos

      }

    });

  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );

    res.status(500).json({
      error:
        "Failed to load show metadata"
    });

  }

}


/*
====================================================
META ROUTES
====================================================
*/

app.get(
  "/meta/series/:id.json",
  async (req,res) => {

    await sendMeta(
      req,
      res
    );

  }
);


app.get(
  "/:config/meta/series/:id.json",
  async (req,res) => {

    await sendMeta(
      req,
      res
    );

  }
);


/*
====================================================
START
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