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

  today.setUTCHours(
    0,
    0,
    0,
    0
  );

  const target = new Date(
    dateString + "T00:00:00Z"
  );

  const sevenDays = new Date(today);

  sevenDays.setUTCDate(
    sevenDays.getUTCDate() + 7
  );

  return target >= today &&
    target <= sevenDays;
}


const DEFAULT_ROWS = [
  "myshows",
  "whatsnext"
];

const ALL_ROWS = [
  "myshows",
  "whatsnext",
  "airingthisweek",
  "returningsoon"
];


function getShowPartFromConfig(config) {

  if (!config) return "";

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
      .map(row => row.trim())
      .filter(
        row => ALL_ROWS.includes(row)
      );

  return rows.length > 0
    ? rows
    : DEFAULT_ROWS;

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
      .filter(
        id => /^\d+$/.test(id)
      );

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
      .map(
        id => Number(id.trim())
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


<button
  class="install"
  onclick="installAddon()"
>
Update My Shows
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

let selected = [];


function applyInitialRows(){

  [
    "myshows",
    "whatsnext",
    "airingthisweek",
    "returningsoon"
  ].forEach(row => {

    document.getElementById(
      "row_" + row
    ).checked =
      initialRows.includes(row);

  });

}


async function searchShows(){

  const query =
    document
      .getElementById("search")
      .value
      .trim();

  if(!query)return;

  const results =
    document.getElementById("results");

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

          return \`
            <div class="show">

              <img src="\${poster}">

              <div class="showInfo">

                <div class="showTitle">
                  \${escapeHtml(show.name)}
                </div>

                <div class="year">
                  \${show.year || ""}
                </div>

              </div>

              <button
                onclick="addShow(
                  \${show.id},
                  '\${escapeJs(show.name)}'
                )"
                \${alreadyAdded ? "disabled" : ""}
              >
                \${alreadyAdded ? "Added" : "Add"}
              </button>

            </div>
          \`;

        })
        .join("");

  }catch(error){

    results.innerHTML =
      '<div class="message">Search failed.</div>';

  }

}


function addShow(id,name){

  if(
    selected.some(
      show => show.id === id
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
      show => show.id !== id
    );

  renderSelected();

  searchShows();

}


function renderSelected(){

  const box =
    document.getElementById(
      "selectedShows"
    );

  if(selected.length === 0){

    box.innerHTML =
      '<div class="message">No shows added yet.</div>';

    return;

  }

  box.innerHTML =
    selected
      .map(show => \`

        <div class="selectedItem">

          <span>
            \${escapeHtml(show.name)}
          </span>

          <button
            class="remove"
            onclick="removeShow(\${show.id})"
          >
            Remove
          </button>

        </div>

      \`)
      .join("");

}


function installAddon(){

  if(selected.length === 0){

    alert(
      "Add at least one show first."
    );

    return;

  }

  const ids =
    selected
      .map(show => show.id)
      .join(",");


  const rows =
    [
      "myshows",
      "whatsnext",
      "airingthisweek",
      "returningsoon"
    ]
    .filter(
      row =>
        document.getElementById(
          "row_" + row
        ).checked
    );


  if(rows.length === 0){

    alert(
      "Turn on at least one Home row."
    );

    return;

  }


  const config =
    ids +
    "~" +
    rows.join(",");


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
      /\\\\/g,
      "\\\\\\\\"
    )
    .replace(
      /'/g,
      "\\\\'"
    )
    .replace(
      /"/g,
      "&quot;"
    );

}


async function loadExistingShows(){

  if(initialIds.length === 0){

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
        results:results
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
LOAD SELECTED SHOWS FOR CONFIG PAGE
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
              Number(id.trim())
          )
          .filter(
            id =>
              Number.isInteger(id) &&
              id > 0
          );


      const results = [];


      for(const id of ids){

        try{

          const show =
            await getShowDetails(id);


          results.push({

            id:
              show.id,

            name:
              show.name

          });


        }catch(error){

          console.error(
            "Failed to load show " + id,
            error.response
              ? error.response.data
              : error.message
          );

        }

      }


      res.json({
        results:results
      });


    }catch(error){

      console.error(
        error.response
          ? error.response.data
          : error.message
      );


      res.status(500).json({
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
    getRowsFromConfig(config);

  const catalogs = [];


  if(
    rows.includes("myshows")
  ){

    catalogs.push({
      type:"series",
      id:"myshows",
      name:"My Shows"
    });

  }


  if(
    rows.includes("whatsnext")
  ){

    catalogs.push({
      type:"series",
      id:"whatsnext",
      name:"What's Next?"
    });

  }


  if(
    rows.includes("airingthisweek")
  ){

    catalogs.push({
      type:"series",
      id:"airingthisweek",
      name:"Airing This Week"
    });

  }


  if(
    rows.includes("returningsoon")
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
      "2.3.2",

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
      null
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
CATALOG — MY SHOWS
====================================================
*/

async function sendMyShows(
  req,
  res,
  config
){

  try{

    if(
      !getRowsFromConfig(config)
        .includes("myshows")
    ){

      return res.json({
        metas:[]
      });

    }


    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);

    const metas = [];


    for(const show of shows){

      const data =
        await getShowDetails(
          show.tmdbId
        );


      let description =
        data.overview || "";


      if(
        data.next_episode_to_air
      ){

        const next =
          data.next_episode_to_air;


        description =
          "Next episode: " +
          "S" +
          next.season_number +
          " E" +
          next.episode_number +
          " - " +
          next.name +
          " • " +
          formatDate(
            next.air_date
          ) +
          " — " +
          description;

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
            "w1280"
          ),

        description:
          description

      });

    }


    res.json({
      metas:metas
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

    if(
      !getRowsFromConfig(config)
        .includes("airingthisweek")
    ){

      return res.json({
        metas:[]
      });

    }


    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);

    const metas = [];


    for(const show of shows){

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
            " — " +
            "Season " +
            next.season_number +
            ", Episode " +
            next.episode_number +
            ": " +
            next.name

        });

      }

    }


    res.json({
      metas:metas
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
WHAT'S NEXT
====================================================
*/

async function sendWhatsNext(
  req,
  res,
  config
){

  try{

    if(
      !getRowsFromConfig(config)
        .includes("whatsnext")
    ){

      return res.json({
        metas:[]
      });

    }


    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);

    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0
    );

    const upcoming = [];


    for(const show of shows){

      try{

        const data =
          await getShowDetails(
            show.tmdbId
          );


        let nextEpisode =
          data.next_episode_to_air ||
          null;


        if(
          !nextEpisode ||
          !nextEpisode.air_date
        ){

          const seasons =
            (data.seasons || [])
              .filter(
                s =>
                  s.season_number > 0
              )
              .sort(
                (a,b) =>
                  a.season_number -
                  b.season_number
              );


          for(
            const season of seasons
          ){

            const seasonEpisodes =
              await getSeasonEpisodes(
                show.tmdbId,
                season.season_number
              );


            const found =
              seasonEpisodes
                .filter(
                  e =>
                    e.air_date &&
                    new Date(
                      e.air_date +
                      "T00:00:00Z"
                    ) >= today
                )
                .sort(
                  (a,b) =>
                    a.air_date.localeCompare(
                      b.air_date
                    ) ||
                    a.episode_number -
                    b.episode_number
                )[0];


            if(found){

              nextEpisode =
                found;

              break;

            }

          }

        }


        if(
          !nextEpisode ||
          !nextEpisode.air_date
        ){

          continue;

        }


        const airDate =
          new Date(
            nextEpisode.air_date +
            "T00:00:00Z"
          );


        if(
          airDate < today
        ){

          continue;

        }


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
                "Next episode: S" +
                next.season_number +
                " E" +
                next.episode_number +
                " — " +
                next.name +
                " • " +
                formatDate(
                  next.air_date
                ) +
                (
                  next.overview
                    ? " — " +
                      next.overview
                    : ""
                )

            };

          }
        )

    });


  }catch(error){

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:
        "Failed to load What's Next?"
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
SMARTER RETURNING SOON
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
    sevenDays.getUTCDate() + 7
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

    if(
      !getRowsFromConfig(config)
        .includes("returningsoon")
    ){

      return res.json({
        metas:[]
      });

    }


    if(!TMDB_API_KEY){

      return res.status(500).json({
        error:
          "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);

    const returning = [];


    for(const show of shows){

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


        const next =
          data.next_episode_to_air;


        if(
          !isReturningSoon(
            next.air_date
          )
        ){

          continue;

        }


        const days =
          daysUntil(
            next.air_date
          );


        returning.push({

          data:
            data,

          episode:
            next,

          daysAway:
            days,

          airTime:
            new Date(
              next.air_date +
              "T00:00:00Z"
            ).getTime()

        });


      }catch(error){

        console.error(
          "Failed to load Returning Soon show " +
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
      metas:metas
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


    /*
    ====================================================
    SEASON-AWARE AIRING PROGRESS
    ====================================================
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
              data.status ===
                "Returning Series" &&
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
            ? data.first_air_date.substring(
                0,
                4
              ) + "-"
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