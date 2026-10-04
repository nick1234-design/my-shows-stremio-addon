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

  const date =
    new Date(
      dateString +
      "T00:00:00Z"
    );

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }
  );
}

function isWithinNext7Days(dateString) {

  if (!dateString) {
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

const DEFAULT_SORT =
  "myorder";

const ALL_SORTS = [
  "myorder",
  "nextepisode",
  "recentlyaired",
  "alphabetical"
];

function getShowPartFromConfig(config) {

  if (!config) {
    return "";
  }

  return String(config)
    .split("~")[0];
}

function getRowsFromConfig(config) {

  if (
    !config ||
    !String(config).includes("~")
  ) {
    return DEFAULT_ROWS;
  }

  const rowPart =
    String(config)
      .split("~")[1] || "";

  const rows =
    rowPart
      .split(",")
      .map(
        row => row.trim()
      )
      .filter(
        row =>
          ALL_ROWS.includes(row)
      );

  return rows.length > 0
    ? rows
    : DEFAULT_ROWS;
}

function getSortFromConfig(config) {

  if (
    !config ||
    !String(config).includes("~")
  ) {
    return DEFAULT_SORT;
  }

  const parts =
    String(config).split("~");

  const sort =
    String(
      parts[2] || ""
    ).trim();

  return ALL_SORTS.includes(sort)
    ? sort
    : DEFAULT_SORT;
}

function getShowsFromConfig(config) {

  if (!config) {
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
        id => id.trim()
      )
      .filter(
        id =>
          /^\d+$/.test(id)
      );

  if (ids.length === 0) {
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
) {

  if (
    sort ===
    "alphabetical"
  ) {

    return items.sort(
      (a, b) =>
        a.data.name.localeCompare(
          b.data.name
        )
    );

  }

  if (
    sort ===
    "nextepisode"
  ) {

    return items.sort(
      (a, b) => {

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

  if (
    sort ===
    "recentlyaired"
  ) {

    return items.sort(
      (a, b) => {

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

      }
    );

  }

  return items.sort(
    (a, b) =>
      a.originalIndex -
      b.originalIndex
  );
}

async function getShowDetails(
  tmdbId
) {

  const response =
    await axios.get(
      tmdbUrl(
        "/tv/" +
        tmdbId
      ),
      {
        params: {
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

app.get(
  "/",
  (req, res) => {

    res.send(`
      <html>

        <head>

          <title>
            My Shows
          </title>

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

          <h1>
            📺 My Shows
          </h1>

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

  }
);


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
      .map(
        id => Number(
          id.trim()
        )
      )
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

<title>
Configure My Shows
</title>

<style>

body{
  margin:0;
  padding:20px;
  background:#111;
  color:white;
  font-family:Arial,sans-serif;
}

.container{
  max-width:700px;
  margin:auto;
}

h1{
  text-align:center;
}

.subtitle{
  text-align:center;
  color:#aaa;
  margin-bottom:25px;
}

.searchBox{
  display:flex;
  gap:10px;
  margin-bottom:20px;
}

.searchBox input{
  flex:1;
  padding:13px;
  border-radius:8px;
  border:1px solid #444;
  background:#222;
  color:white;
  font-size:16px;
}

button{
  padding:11px 15px;
  border:0;
  border-radius:8px;
  background:#7c4dff;
  color:white;
  cursor:pointer;
}

button:disabled{
  opacity:.5;
}

.section{
  margin-top:25px;
}

.sectionTitle{
  font-size:20px;
  font-weight:bold;
  margin-bottom:12px;
}

.message{
  color:#999;
  padding:15px;
  background:#1b1b1b;
  border-radius:8px;
}

.show{
  display:flex;
  align-items:center;
  gap:12px;
  padding:10px;
  margin-bottom:8px;
  background:#1b1b1b;
  border-radius:10px;
}

.show img{
  width:55px;
  height:80px;
  object-fit:cover;
  border-radius:6px;
}

.showInfo{
  flex:1;
}

.showTitle{
  font-weight:bold;
}

.year{
  color:#888;
  margin-top:4px;
}

.selectedItem{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:12px;
  background:#1b1b1b;
  border-radius:8px;
  margin-bottom:8px;
}

.remove{
  background:#444;
}

.rowsBox,
.sortBox{
  background:#1b1b1b;
  padding:15px;
  border-radius:10px;
  margin-top:15px;
}

.rowOption{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px 0;
}

.rowOption input{
  width:20px;
  height:20px;
}

.sortTitle{
  font-size:18px;
  font-weight:bold;
}

.sortDescription{
  color:#999;
  font-size:14px;
  margin:7px 0 12px;
  line-height:1.4;
}

.sortBox select{
  width:100%;
  padding:12px;
  border-radius:8px;
  border:1px solid #444;
  background:#222;
  color:white;
  font-size:16px;
}

.install{
  margin-top:30px;
  text-align:center;
}

.installUrl{
  word-break:break-all;
  background:#1b1b1b;
  padding:12px;
  border-radius:8px;
  margin-top:12px;
  color:#aaa;
}

</style>

</head>

<body>

<div class="container">

<h1>
📺 Configure My Shows
</h1>

<div class="subtitle">
Add the shows you want to track.
</div>

<div class="searchBox">

<input
  id="search"
  placeholder="Search for a TV show..."
>

<button
  onclick="searchShows()"
>
Search
</button>

</div>

<div
  id="results"
  class="section"
></div>

<div class="section">

<div class="sectionTitle">
My Shows
</div>

<div id="selectedShows">

<div class="message">
Loading your shows...
</div>

</div>

</div>

<div class="rowsBox">

<div class="sectionTitle">
Home Rows
</div>

<div class="rowOption">

<input
  type="checkbox"
  id="row_myshows"
  value="myshows"
>

<label for="row_myshows">
My Shows
</label>

</div>

<div class="rowOption">

<input
  type="checkbox"
  id="row_whatsnext"
  value="whatsnext"
>

<label for="row_whatsnext">
What's Next?
</label>

</div>

<div class="rowOption">

<input
  type="checkbox"
  id="row_airingthisweek"
  value="airingthisweek"
>

<label for="row_airingthisweek">
Airing This Week
</label>

</div>

<div class="rowOption">

<input
  type="checkbox"
  id="row_recentlyaired"
  value="recentlyaired"
>

<label for="row_recentlyaired">
Recently Aired
</label>

</div>

<div class="rowOption">

<input
  type="checkbox"
  id="row_returningsoon"
  value="returningsoon"
>

<label for="row_returningsoon">
Returning Soon
</label>

</div>

</div>

<div class="sortBox">

<div class="sortTitle">
Sort My Shows
</div>

<div class="sortDescription">
Choose how your shows appear in the My Shows row. Other smart rows keep their own date-based order.
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

<div class="install">

<button
  onclick="installAddon()"
>
Generate My Addon
</button>

<div
  id="installBox"
  style="display:none"
>

<div class="installUrl">

<span id="installUrl"></span>

</div>

<br>

<button
  onclick="openStremio()"
>
Open in Stremio
</button>

</div>

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
      .map(
        show =>
          '<div class="selectedItem">' +
          '<span>' +
          escapeHtml(
            show.name
          ) +
          '</span>' +
          '<button class="remove" onclick="removeShow(' +
          show.id +
          ')">Remove</button>' +
          '</div>'
      )
      .join("");

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

async function searchShows(){

  const query =
    document
      .getElementById(
        "search"
      )
      .value
      .trim();

  const results =
    document.getElementById(
      "results"
    );

  if(!query){

    results.innerHTML =
      '<div class="message">Enter a show name first.</div>';

    return;

  }

  results.innerHTML =
    '<div class="message">Searching...</div>';

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
        .map(
          show => {

            const poster =
              show.poster ||
              "";

            const alreadyAdded =
              selected.some(
                item =>
                  item.id ===
                  show.id
              );

            return (
              '<div class="show">' +

              '<img src="' +
              poster +
              '" alt="">' +

              '<div class="showInfo">' +

              '<div class="showTitle">' +
              escapeHtml(
                show.name
              ) +
              '</div>' +

              '<div class="year">' +
              (
                show.year ||
                ""
              ) +
              '</div>' +

              '</div>' +

              '<button onclick="addShow(' +
              show.id +
              ', \'' +
              escapeJs(
                show.name
              ) +
              '\')" ' +

              (
                alreadyAdded
                  ? 'disabled'
                  : ''
              ) +

              '>' +

              (
                alreadyAdded
                  ? 'Added'
                  : 'Add'
              ) +

              '</button>' +

              '</div>'
            );

          }
        )
        .join("");

  }catch(error){

    console.error(
      error
    );

    results.innerHTML =
      '<div class="message">Search failed.</div>';

  }

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
    );

}

async function loadInitialShows(){

  if(
    !initialIds ||
    initialIds.length === 0
  ){

    selected = [];

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
      data.shows &&
      Array.isArray(
        data.shows
      )
    ){

      selected =
        data.shows.map(
          show => ({
            id:
              Number(
                show.tmdbId
              ),
            name:
              show.name
          })
        );

    }

  }catch(error){

    console.error(
      error
    );

    selected =
      initialIds.map(
        id => ({
          id:
            Number(id),
          name:
            "TMDB " +
            id
        })
      );

  }

  renderSelected();

}

function initializeRows(){

  const rows =
    initialRows || [];

  [
    "myshows",
    "whatsnext",
    "airingthisweek",
    "recentlyaired",
    "returningsoon"
  ].forEach(
    row => {

      const checkbox =
        document.getElementById(
          "row_" + row
        );

      if(checkbox){

        checkbox.checked =
          rows.includes(row);

      }

    }
  );

}

function initializeSort(){

  const select =
    document.getElementById(
      "sortOrder"
    );

  if(select){

    select.value =
      initialSort ||
      "myorder";

  }

}

function installAddon(){

  if(
    selected.length === 0
  ){

    alert(
      "Please add at least one show."
    );

    return;

  }

  const ids =
    selected
      .map(
        show =>
          show.id
      )
      .join(",");

  const rows =
    [
      "myshows",
      "whatsnext",
      "airingthisweek",
      "recentlyaired",
      "returningsoon"
    ]
      .filter(
        row => {

          const checkbox =
            document.getElementById(
              "row_" + row
            );

          return (
            checkbox &&
            checkbox.checked
          );

        }
      );

  if(
    rows.length === 0
  ){

    alert(
      "Turn on at least one Home row."
    );

    return;

  }

  const sort =
    document.getElementById(
      "sortOrder"
    ).value ||
    "myorder";

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

  document.getElementById(
    "installUrl"
  ).textContent =
    manifestUrl;

  document.getElementById(
    "installBox"
  ).style.display =
    "block";

  window.generatedManifestUrl =
    manifestUrl;

}

function openStremio(){

  if(
    !window.generatedManifestUrl
  ){

    return;

  }

  window.location.href =
    "stremio://" +
    window.generatedManifestUrl.replace(
      /^https?:\/\//,
      ""
    );

}

document
  .getElementById(
    "search"
  )
  .addEventListener(
    "keydown",
    event => {

      if(
        event.key ===
        "Enter"
      ){

        searchShows();

      }

    }
  );

initializeRows();

initializeSort();

loadInitialShows();

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
SEARCH
====================================================
*/

app.get(
  "/api/search",
  async (req,res) => {

    try{

      const query =
        String(
          req.query.query ||
          ""
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
              page:1
            }
          }
        );

      const results =
        (
          response.data.results ||
          []
        )
          .slice(0,20)
          .map(
            show => ({
              tmdbId:
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
                )
            })
          );

      res.json({
        results:
          results
      });

    }catch(error){

      console.error(
        "Search error",
        error.response
          ? error.response.data
          : error.message
      );

      res
        .status(500)
        .json({
          error:
            "Search failed"
        });

    }

  }
);


/*
====================================================
LOAD SHOWS
====================================================
*/

app.get(
  "/api/shows",
  async (req,res) => {

    try{

      const ids =
        String(
          req.query.ids ||
          ""
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

      const shows = [];

      for(
        const id of ids
      ){

        try{

          const data =
            await getShowDetails(
              id
            );

          shows.push({
            tmdbId:
              data.id,
            name:
              data.name
          });

        }catch(error){

          console.error(
            "Show lookup error",
            id,
            error.message
          );

        }

      }

      res.json({
        shows:
          shows
      });

    }catch(error){

      console.error(
        "API shows error",
        error.message
      );

      res
        .status(500)
        .json({
          error:
            "Failed to load shows"
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

  const rows =
    getRowsFromConfig(
      config
    );

  const catalogNames = {
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

  const catalogs =
    rows.map(
      row => ({
        type:
          "series",
        id:
          row,
        name:
          catalogNames[row] ||
          row
      })
    );

  return {

    id:
      "com.nick1234.myshows",

    version:
      "2.4.1",

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
      configurable:
        true
    },

    catalogs:
      catalogs

  };

}

app.get(
  "/manifest.json",
  (req,res) => {

    res.json(
      buildManifest("")
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
            data.next_episode_to_air.air_date +
            "T00:00:00Z"
          ).getTime();

      }

      if(
        data.last_episode_to_air &&
        data.last_episode_to_air.air_date
      ){

        lastTime =
          new Date(
            data.last_episode_to_air.air_date +
            "T00:00:00Z"
          ).getTime();

      }

      items.push({

        data:{

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
            )

        },

        originalIndex:
          index,

        nextTime:
          nextTime,

        lastTime:
          lastTime

      });

    }catch(error){

      console.error(
        "My Shows error",
        show.tmdbId,
        error.message
      );

    }

  }

  sortMyShows(
    items,
    sort
  );

  res.json({
    metas:
      items.map(
        item =>
          item.data
      )
  });

}


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

      if(
        !data.next_episode_to_air ||
        !data.next_episode_to_air.air_date
      ){

        continue;

      }

      if(
        !isWithinNext7Days(
          data.next_episode_to_air.air_date
        )
      ){

        continue;

      }

      const episode =
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
            "original"
          ),

        description:
          "📅 Airs " +
          formatDate(
            episode.air_date
          ) +
          "\n\n" +
          "Season " +
          episode.season_number +
          " • Episode " +
          episode.episode_number +
          ": " +
          (
            episode.name ||
            "Upcoming Episode"
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

  res.json({
    metas:
      metas
  });

}


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
          "📅 Next episode: " +
          formatDate(
            episode.air_date
          ) +
          "\n\n" +
          "Season " +
          episode.season_number +
          " • Episode " +
          episode.episode_number +
          ": " +
          (
            episode.name ||
            "Upcoming Episode"
          )

      });

    }catch(error){

      console.error(
        "What's Next error",
        show.tmdbId,
        error.message
      );

    }

  }

  metas.sort(
    (a,b) =>
      a.name.localeCompare(
        b.name
      )
  );

  res.json({
    metas:
      metas
  });

}


/*
====================================================
RECENTLY AIRED
====================================================
*/

async function sendRecentlyAired(
  req,
  res,
  config
){

  const shows =
    getShowsFromConfig(
      config
    );

  const metas = [];

  const today =
    new Date();

  today.setUTCHours(
    0,
    0,
    0,
    0
  );

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

      const episode =
        data.last_episode_to_air;

      const airDate =
        new Date(
          episode.air_date +
          "T00:00:00Z"
        );

      const difference =
        Math.round(
          (
            today.getTime() -
            airDate.getTime()
          ) /
          86400000
        );

      if(
        difference < 0 ||
        difference > 7
      ){

        continue;

      }

      let relativeText =
        "";

      if(
        difference === 0
      ){

        relativeText =
          "Aired today";

      }else if(
        difference === 1
      ){

        relativeText =
          "Aired yesterday";

      }else{

        relativeText =
          "Aired " +
          difference +
          " days ago";

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
            "Episode"
          ) +
          "\n\n" +
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

  metas.sort(
    (a,b) => {
      return 0;
    }
  );

  res.json({
    metas:
      metas
  });

}


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

  return target >
    sevenDays;

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

      const airDate =
        data.next_episode_to_air.air_date;

      if(
        !isReturningSoon(
          airDate
        )
      ){

        continue;

      }

      const episode =
        data.next_episode_to_air;

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
          "\n\n" +
          "Season " +
          episode.season_number +
          " • Episode " +
          episode.episode_number +
          ": " +
          (
            episode.name ||
            "Upcoming Episode"
          ) +
          "\n\n" +
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


/*
====================================================
CATALOG ROUTES
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

            episode:
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
      data.status ===
      "Ended"
    ){

      statusText =
        "🔴 Ended";

    }else if(
      data.status ===
      "Canceled"
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
          "\n📅 Next episode: " +
          formatDate(
            data.next_episode_to_air.air_date
          );

      }

    }else if(
      data.status ===
      "Returning Series"
    ){

      statusText =
        "🔵 Returning Series";

    }else if(
      data.status ===
      "In Production"
    ){

      statusText =
        "🟡 In Production";

    }else if(
      data.status ===
      "Planned"
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
      progressSeasonNumber !==
      null
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

    if(data.overview){

      detailsParts.push(
        data.overview
      );

    }

    const description =
      detailsParts.join(
        "\n\n"
      );

    res.json({

      meta:{

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

        logo:
          imageUrl(
            data.logo_path,
            "original"
          ),

        description:
          description,

        releaseInfo:
          data.first_air_date
            ? data.first_air_date.substring(
                0,
                4
              )
            : "",

        genres:
          data.genres
            ? data.genres.map(
                genre =>
                  genre.name
              )
            : [],

        videos:
          videos

      }

    });

  }catch(error){

    console.error(
      "Meta error",
      tmdbId,
      error.response
        ? error.response.data
        : error.message
    );

    res
      .status(500)
      .json({
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
  "/meta/series/tmdb\\::tmdbId.json",
  async (req,res) => {

    await sendMeta(
      req,
      res,
      Number(
        req.params.tmdbId
      )
    );

  }
);

app.get(
  "/:config/meta/series/tmdb\\::tmdbId.json",
  async (req,res) => {

    await sendMeta(
      req,
      res,
      Number(
        req.params.tmdbId
      )
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