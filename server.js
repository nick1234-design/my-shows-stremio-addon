const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY =
  process.env.TMDB_API_KEY;

const TMDB_BASE =
  "https://api.themoviedb.org/3";

const TMDB_IMAGE =
  "https://image.tmdb.org/t/p/";

const DEFAULT_SHOWS = [
  292742,
  291350,
  247718,
  304842,
  153312,
  202297,
  253391,
  302074
];

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

function imageUrl(
  path,
  size = "w500"
){

  if(!path){
    return undefined;
  }

  return (
    TMDB_IMAGE +
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

  if(
    Number.isNaN(
      date.getTime()
    )
  ){
    return null;
  }

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

function getShowPartFromConfig(
  config
){

  if(!config){
    return "";
  }

  return String(
    config
  ).split("~")[0];

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

  const parts =
    String(config).split("~");

  const rowPart =
    String(
      parts[1] || ""
    );

  const rows =
    rowPart
      .split(",")
      .filter(
        row =>
          ALL_ROWS.includes(row)
      );

  return rows.length
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
    String(config).split("~");

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

  const showPart =
    getShowPartFromConfig(
      config
    );

  if(!showPart){
    return DEFAULT_SHOWS;
  }

  const ids =
    showPart
      .split(",")
      .map(
        id => Number(id)
      )
      .filter(
        id =>
          Number.isFinite(id)
      );

  return ids.length
    ? ids
    : DEFAULT_SHOWS;

}

async function tmdb(
  path,
  params = {}
){

  const response =
    await axios.get(
      TMDB_BASE + path,
      {
        params:{
          api_key:
            TMDB_API_KEY,
          ...params
        }
      }
    );

  return response.data;

}

async function getShowDetails(
  tmdbId
){

  return tmdb(
    "/tv/" + tmdbId,
    {
      append_to_response:
        "content_ratings"
    }
  );

}

async function getSeasonEpisodes(
  tmdbId,
  seasonNumber
){

  const data =
    await tmdb(
      "/tv/" +
      tmdbId +
      "/season/" +
      seasonNumber
    );

  return data.episodes || [];

}

function getNextEpisode(
  data
){

  if(
    data &&
    data.next_episode_to_air
  ){

    return data.next_episode_to_air;

  }

  return null;

}

function getLastEpisode(
  data
){

  if(
    data &&
    data.last_episode_to_air
  ){

    return data.last_episode_to_air;

  }

  return null;

}

function episodeDateTime(
  episode
){

  if(
    !episode ||
    !episode.air_date
  ){
    return null;
  }

  const time =
    new Date(
      episode.air_date +
      "T00:00:00Z"
    ).getTime();

  return Number.isFinite(time)
    ? time
    : null;

}

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
          aTime - bTime ||
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
          bTime - aTime ||
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

function dateLabel(
  dateString
){

  if(!dateString){
    return "";
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

  const difference =
    Math.round(
      (
        target.getTime() -
        today.getTime()
      ) /
      86400000
    );

  if(
    difference === 0
  ){
    return "today";
  }

  if(
    difference === 1
  ){
    return "tomorrow";
  }

  if(
    difference > 1 &&
    difference <= 7
  ){

    return target.toLocaleDateString(
      "en-US",
      {
        weekday:
          "long",
        timeZone:
          "UTC"
      }
    );

  }

  return formatDate(
    dateString
  );

}

function daysAgoLabel(
  dateString
){

  if(!dateString){
    return "";
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

  const difference =
    Math.round(
      (
        today.getTime() -
        target.getTime()
      ) /
      86400000
    );

  if(
    difference === 0
  ){
    return "today";
  }

  if(
    difference === 1
  ){
    return "yesterday";
  }

  return (
    difference +
    " days ago"
  );

}

function showSummary(
  data
){

  const next =
    getNextEpisode(
      data
    );

  if(next){

    return {
      nextEpisode:
        next,

      nextTime:
        episodeDateTime(
          next
        )
    };

  }

  const last =
    getLastEpisode(
      data
    );

  return {
    nextEpisode:
      null,

    nextTime:
      null,

    lastEpisode:
      last,

    lastTime:
      episodeDateTime(
        last
      )
  };

}

async function searchShows(
  query
){

  const data =
    await tmdb(
      "/search/tv",
      {
        query
      }
    );

  return data.results || [];

}

function configurePage(
  configString
){

  const initialIds =
    getShowsFromConfig(
      configString
    );

  const initialRows =
    getRowsFromConfig(
      configString
    );

  const initialSort =
    getSortFromConfig(
      configString
    );

  const escapedConfig =
    JSON.stringify(
      configString || ""
    );

  return `
<!DOCTYPE html>
<html>
<head>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<title>
My Shows
</title>

<style>

body{
  font-family:
    Arial,
    sans-serif;

  background:
    #111;

  color:
    white;

  margin:
    0;

  padding:
    20px;
}

.container{
  max-width:
    700px;

  margin:
    auto;
}

h1{
  margin-top:
    0;
}

.card{
  background:
    #1d1d1d;

  border:
    1px solid #333;

  border-radius:
    12px;

  padding:
    16px;

  margin-bottom:
    14px;
}

.show{
  display:
    flex;

  align-items:
    center;

  gap:
    12px;

  padding:
    10px 0;

  border-bottom:
    1px solid #333;
}

.show:last-child{
  border-bottom:
    none;
}

.showName{
  flex:
    1;
}

button,
select,
input{
  font-size:
    16px;

  padding:
    10px;

  border-radius:
    8px;

  border:
    1px solid #444;
}

button{
  cursor:
    pointer;
}

.searchRow{
  display:
    flex;

  gap:
    8px;
}

.searchRow input{
  flex:
    1;
}

.results{
  margin-top:
    12px;
}

.result{
  display:
    flex;

  justify-content:
    space-between;

  align-items:
    center;

  padding:
    10px 0;

  border-bottom:
    1px solid #333;
}

.switchRow{
  display:
    flex;

  align-items:
    center;

  gap:
    10px;

  padding:
    8px 0;
}

.sortBox{
  margin-top:
    16px;
}

.sortTitle{
  font-weight:
    bold;

  margin-bottom:
    6px;
}

.sortDescription{
  color:
    #aaa;

  margin-bottom:
    10px;

  line-height:
    1.4;
}

.status{
  color:
    #aaa;

  font-size:
    14px;
}

.remove{
  background:
    #333;

  color:
    white;
}

.add{
  background:
    #fff;

  color:
    #111;
}

.install{
  width:
    100%;

  margin-top:
    14px;

  background:
    #fff;

  color:
    #111;
}

</style>

</head>

<body>

<div
  class="container"
>

<h1>
My Shows
</h1>

<div
  class="card"
>

<strong>
Your Shows
</strong>

<div
  id="showList"
>
Loading...
</div>

</div>

<div
  class="card"
>

<strong>
Add a Show
</strong>

<div
  class="searchRow"
>

<input
  id="search"
  placeholder="Search TV shows..."
/>

<button
  id="searchButton"
  type="button"
>
Search
</button>

</div>

<div
  id="results"
  class="results"
></div>

</div>

<div
  class="card"
>

<strong>
Home Rows
</strong>

<div
  class="switchRow"
>

<input
  type="checkbox"
  id="row-myshows"
/>

<label
  for="row-myshows"
>
My Shows
</label>

</div>

<div
  class="switchRow"
>

<input
  type="checkbox"
  id="row-whatsnext"
/>

<label
  for="row-whatsnext"
>
What's Next?
</label>

</div>

<div
  class="switchRow"
>

<input
  type="checkbox"
  id="row-airingthisweek"
/>

<label
  for="row-airingthisweek"
>
Airing This Week
</label>

</div>

<div
  class="switchRow"
>

<input
  type="checkbox"
  id="row-recentlyaired"
/>

<label
  for="row-recentlyaired"
>
Recently Aired
</label>

</div>

<div
  class="switchRow"
>

<input
  type="checkbox"
  id="row-returningsoon"
/>

<label
  for="row-returningsoon"
>
Returning Soon
</label>

</div>

<div
  class="sortBox"
>

<div
  class="sortTitle"
>
Sort My Shows
</div>

<div
  class="sortDescription"
>
Choose how your shows appear in the My Shows row. Other smart rows keep their own date-based order.
</div>

<select
  id="sortOrder"
>

<option
  value="myorder"
>
My Order
</option>

<option
  value="nextepisode"
>
Next Episode
</option>

<option
  value="recentlyaired"
>
Recently Aired
</option>

<option
  value="alphabetical"
>
Alphabetical
</option>

</select>

</div>

<button
  class="install"
  id="installButton"
  type="button"
>
Install / Update Addon
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

const configString =
  ${escapedConfig};

let ids =
  initialIds.slice();

function renderShows(
  shows
){

  const list =
    document.getElementById(
      "showList"
    );

  list.innerHTML =
    "";

  if(
    !shows.length
  ){

    list.innerHTML =
      "<div class='status'>No shows added yet.</div>";

    return;

  }

  shows.forEach(
    show => {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "show";

      const name =
        document.createElement(
          "div"
        );

      name.className =
        "showName";

      name.textContent =
        show.name ||
        "Unknown Show";

      const button =
        document.createElement(
          "button"
        );

      button.className =
        "remove";

      button.textContent =
        "Remove";

      button.type =
        "button";

      button.addEventListener(
        "click",
        () => {

          ids =
            ids.filter(
              id =>
                String(id) !==
                String(show.id)
            );

          renderShows(
            shows.filter(
              item =>
                String(item.id) !==
                String(show.id)
            )
          );

        }
      );

      row.appendChild(
        name
      );

      row.appendChild(
        button
      );

      list.appendChild(
        row
      );

    }
  );

}

async function loadShows(){

  try{

    const response =
      await fetch(
        "/api/shows?ids=" +
        ids.join(",")
      );

    const data =
      await response.json();

    renderShows(
      data.shows || []
    );

  }catch(error){

    document.getElementById(
      "showList"
    ).textContent =
      "Unable to load shows.";

  }

}

function selectedRows(){

  return ALL_ROWS
    .filter(
      row => {

        const checkbox =
          document.getElementById(
            "row-" + row
          );

        return (
          checkbox &&
          checkbox.checked
        );

      }
    );

}

const ALL_ROWS =
  [
    "myshows",
    "whatsnext",
    "airingthisweek",
    "recentlyaired",
    "returningsoon"
  ];

function installAddon(){

  const rows =
    selectedRows();

  const selectedSort =
    document.getElementById(
      "sortOrder"
    ).value;

  const rowPart =
    rows.length
      ? rows.join(",")
      : "myshows";

  const addonConfig =
    ids.join(",") +
    "~" +
    rowPart +
    "~" +
    selectedSort;

  const base =
    window.location.origin;

  const manifestUrl =
    base +
    "/" +
    addonConfig +
    "/manifest.json";

  const stremioUrl =
    "stremio://"
    +
    manifestUrl.replace(
      /^https?:\/\//,
      ""
    );

  window.location.href =
    stremioUrl;

}

async function search(){

  const query =
    document.getElementById(
      "search"
    ).value.trim();

  const results =
    document.getElementById(
      "results"
    );

  if(!query){

    results.innerHTML =
      "";

    return;

  }

  results.textContent =
    "Searching...";

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

    results.innerHTML =
      "";

    (
      data.results ||
      []
    ).forEach(
      show => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "result";

        const title =
          document.createElement(
            "span"
          );

        title.textContent =
          show.name;

        const button =
          document.createElement(
            "button"
          );

        button.className =
          "add";

        button.type =
          "button";

        button.textContent =
          "Add";

        button.addEventListener(
          "click",
          () => {

            if(
              !ids.includes(
                Number(show.id)
              )
            ){

              ids.push(
                Number(show.id)
              );

            }

            loadShows();

            button.textContent =
              "Added";

          }
        );

        row.appendChild(
          title
        );

        row.appendChild(
          button
        );

        results.appendChild(
          row
        );

      }
    );

  }catch(error){

    results.textContent =
      "Search failed.";

  }

}

document.getElementById(
  "searchButton"
).addEventListener(
  "click",
  search
);

document.getElementById(
  "search"
).addEventListener(
  "keydown",
  event => {

    if(
      event.key ===
      "Enter"
    ){

      search();

    }

  }
);

document.getElementById(
  "installButton"
).addEventListener(
  "click",
  installAddon
);

initialRows.forEach(
  row => {

    const checkbox =
      document.getElementById(
        "row-" + row
      );

    if(checkbox){
      checkbox.checked =
        true;
    }

  }
);

document.getElementById(
  "sortOrder"
).value =
  initialSort;

loadShows();

</script>

</body>
</html>
`;

}

app.get(
  "/configure",
  (
    req,
    res
  ) => {

    res.type(
      "html"
    );

    res.send(
      configurePage("")
    );

  }
);

app.get(
  "/:config/configure",
  (
    req,
    res
  ) => {

    res.type(
      "html"
    );

    res.send(
      configurePage(
        req.params.config
      )
    );

  }
);

app.get(
  "/api/search",
  async (
    req,
    res
  ) => {

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

      const results =
        await searchShows(
          query
        );

      res.json({
        results:
          results.map(
            show => ({
              id:
                show.id,

              name:
                show.name,

              poster:
                imageUrl(
                  show.poster_path
                ),

              overview:
                show.overview ||
                ""
            })
          )
      });

    }catch(error){

      console.error(
        "Search error",
        error.message
      );

      res.status(500).json({
        error:
          "Search failed"
      });

    }

  }
);

app.get(
  "/api/shows",
  async (
    req,
    res
  ) => {

    try{

      const raw =
        String(
          req.query.ids ||
          ""
        );

      const ids =
        raw
          .split(",")
          .map(
            id => Number(id)
          )
          .filter(
            id =>
              Number.isFinite(id)
          );

      const shows =
        await Promise.all(
          ids.map(
            async id => {

              try{

                const data =
                  await getShowDetails(
                    id
                  );

                return {
                  id,
                  name:
                    data.name ||
                    "Unknown Show"
                };

              }catch(error){

                return {
                  id,
                  name:
                    "Unknown Show"
                };

              }

            }
          )
        );

      res.json({
        shows
      });

    }catch(error){

      console.error(
        "Shows error",
        error.message
      );

      res.status(500).json({
        error:
          "Unable to load shows"
      });

    }

  }
);

function sendManifest(
  req,
  res,
  config
){

  const ids =
    getShowsFromConfig(
      config
    );

  const rows =
    getRowsFromConfig(
      config
    );

  const catalogs =
    [];

  if(
    rows.includes(
      "myshows"
    )
  ){

    catalogs.push({
      type:
        "series",

      id:
        "myshows",

      name:
        "My Shows"
    });

  }

  if(
    rows.includes(
      "whatsnext"
    )
  ){

    catalogs.push({
      type:
        "series",

      id:
        "whatsnext",

      name:
        "What's Next?"
    });

  }

  if(
    rows.includes(
      "airingthisweek"
    )
  ){

    catalogs.push({
      type:
        "series",

      id:
        "airingthisweek",

      name:
        "Airing This Week"
    });

  }

  if(
    rows.includes(
      "recentlyaired"
    )
  ){

    catalogs.push({
      type:
        "series",

      id:
        "recentlyaired",

      name:
        "Recently Aired"
    });

  }

  if(
    rows.includes(
      "returningsoon"
    )
  ){

    catalogs.push({
      type:
        "series",

      id:
        "returningsoon",

      name:
        "Returning Soon"
    });

  }

  res.json({

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

    catalogs

  });

}

app.get(
  "/manifest.json",
  (
    req,
    res
  ) => {

    sendManifest(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/:config/manifest.json",
  (
    req,
    res
  ) => {

    sendManifest(
      req,
      res,
      req.params.config
    );

  }
);

async function sendMyShows(
  req,
  res,
  config
){

  try{

    const ids =
      getShowsFromConfig(
        config
      );

    const sort =
      getSortFromConfig(
        config
      );

    const items =
      [];

    for(
      let index = 0;
      index < ids.length;
      index++
    ){

      const id =
        ids[index];

      try{

        const data =
          await getShowDetails(
            id
          );

        const summary =
          showSummary(
            data
          );

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
                "w1280"
              ),

            description:
              data.overview ||
              "",

            releaseInfo:
              data.first_air_date
                ? data.first_air_date
                : undefined

          },

          originalIndex:
            index,

          nextTime:
            summary.nextTime,

          lastTime:
            summary.lastTime

        });

      }catch(error){

        console.error(
          "My show error",
          id,
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

  }catch(error){

    console.error(
      "My Shows error",
      error.message
    );

    res.status(500).json({
      metas:[]
    });

  }

}

async function sendAiringThisWeek(
  req,
  res,
  config
){

  try{

    const ids =
      getShowsFromConfig(
        config
      );

    const metas =
      [];

    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0
    );

    const weekEnd =
      new Date(
        today
      );

    weekEnd.setUTCDate(
      weekEnd.getUTCDate() +
      7
    );

    for(
      const id of ids
    ){

      try{

        const data =
          await getShowDetails(
            id
          );

        const next =
          getNextEpisode(
            data
          );

        if(
          next &&
          next.air_date
        ){

          const date =
            new Date(
              next.air_date +
              "T00:00:00Z"
            );

          if(
            date >= today &&
            date <= weekEnd
          ){

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
                "📅 Airs " +
                dateLabel(
                  next.air_date
                ),

              releaseInfo:
                next.air_date

            });

          }

        }

      }catch(error){

        console.error(
          "Airing this week error",
          id,
          error.message
        );

      }

    }

    res.json({
      metas
    });

  }catch(error){

    console.error(
      "Airing this week error",
      error.message
    );

    res.status(500).json({
      metas:[]
    });

  }

}

async function sendWhatsNext(
  req,
  res,
  config
){

  try{

    const ids =
      getShowsFromConfig(
        config
      );

    const metas =
      [];

    for(
      const id of ids
    ){

      try{

        const data =
          await getShowDetails(
            id
          );

        const next =
          getNextEpisode(
            data
          );

        if(
          next &&
          next.air_date
        ){

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
              "📺 S" +
              next.season_number +
              " E" +
              next.episode_number +
              " — " +
              (
                next.name ||
                "Episode"
              ) +
              "\n\n" +
              "📅 " +
              dateLabel(
                next.air_date
              ),

            releaseInfo:
              next.air_date

          });

        }

      }catch(error){

        console.error(
          "What's next error",
          id,
          error.message
        );

      }

    }

    metas.sort(
      (a,b) =>
        String(
          a.releaseInfo ||
          ""
        ).localeCompare(
          String(
            b.releaseInfo ||
            ""
          )
        )
    );

    res.json({
      metas
    });

  }catch(error){

    console.error(
      "What's Next error",
      error.message
    );

    res.status(500).json({
      metas:[]
    });

  }

}

async function sendRecentlyAired(
  req,
  res,
  config
){

  try{

    const ids =
      getShowsFromConfig(
        config
      );

    const metas =
      [];

    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0
    );

    const sevenDaysAgo =
      new Date(
        today
      );

    sevenDaysAgo.setUTCDate(
      sevenDaysAgo.getUTCDate() -
      7
    );

    for(
      const id of ids
    ){

      try{

        const data =
          await getShowDetails(
            id
          );

        const last =
          getLastEpisode(
            data
          );

        if(
          last &&
          last.air_date
        ){

          const date =
            new Date(
              last.air_date +
              "T00:00:00Z"
            );

          if(
            date >= sevenDaysAgo &&
            date <= today
          ){

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
                "🆕 S" +
                last.season_number +
                " E" +
                last.episode_number +
                " — " +
                (
                  last.name ||
                  "Episode"
                ) +
                "\n\n" +
                "📅 Aired " +
                daysAgoLabel(
                  last.air_date
                ),

              releaseInfo:
                last.air_date

            });

          }

        }

      }catch(error){

        console.error(
          "Recently aired error",
          id,
          error.message
        );

      }

    }

    res.json({
      metas
    });

  }catch(error){

    console.error(
      "Recently aired error",
      error.message
    );

    res.status(500).json({
      metas:[]
    });

  }

}

async function sendReturningSoon(
  req,
  res,
  config
){

  try{

    const ids =
      getShowsFromConfig(
        config
      );

    const metas =
      [];

    for(
      const id of ids
    ){

      try{

        const data =
          await getShowDetails(
            id
          );

        const next =
          getNextEpisode(
            data
          );

        if(
          next &&
          next.air_date &&
          isReturningSoon(
            next.air_date
          )
        ){

          const days =
            daysUntil(
              next.air_date
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
              (
                next.name ||
                "Episode"
              ) +
              "\n" +
              "📅 In " +
              days +
              " days",

            releaseInfo:
              next.air_date

          });

        }

      }catch(error){

        console.error(
          "Returning soon error",
          id,
          error.message
        );

      }

    }

    metas.sort(
      (a,b) =>
        String(
          a.releaseInfo ||
          ""
        ).localeCompare(
          String(
            b.releaseInfo ||
            ""
          )
        )
    );

    res.json({
      metas
    });

  }catch(error){

    console.error(
      "Returning soon error",
      error.message
    );

    res.status(500).json({
      metas:[]
    });

  }

}

app.get(
  "/:config/catalog/series/myshows.json",
  async (
    req,
    res
  ) => {

    await sendMyShows(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/airingthisweek.json",
  async (
    req,
    res
  ) => {

    await sendAiringThisWeek(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/whatsnext.json",
  async (
    req,
    res
  ) => {

    await sendWhatsNext(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/recentlyaired.json",
  async (
    req,
    res
  ) => {

    await sendRecentlyAired(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/:config/catalog/series/returningsoon.json",
  async (
    req,
    res
  ) => {

    await sendReturningSoon(
      req,
      res,
      req.params.config
    );

  }
);

app.get(
  "/catalog/series/myshows.json",
  async (
    req,
    res
  ) => {

    await sendMyShows(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/airingthisweek.json",
  async (
    req,
    res
  ) => {

    await sendAiringThisWeek(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/whatsnext.json",
  async (
    req,
    res
  ) => {

    await sendWhatsNext(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/recentlyaired.json",
  async (
    req,
    res
  ) => {

    await sendRecentlyAired(
      req,
      res,
      ""
    );

  }
);

app.get(
  "/catalog/series/returningsoon.json",
  async (
    req,
    res
  ) => {

    await sendReturningSoon(
      req,
      res,
      ""
    );

  }
);

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
      data.status === "Ended"
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
        data.next_episode_to_air
          .air_date
      ){

        statusText +=
          "\n📅 Next episode: " +
          formatDate(
            data.next_episode_to_air
              .air_date
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

    let progressText =
      "";

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

    const detailsParts =
      [];

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

    if(
      data.overview
    ){

      detailsParts.push(
        data.overview
      );

    }

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
            "w1280"
          ),

        description:
          detailsParts.join(
            "\n\n"
          ),

        releaseInfo:
          data.first_air_date
            ? new Date(
                data.first_air_date
              ).getUTCFullYear()
              .toString()
            : undefined,

        genres:
          data.genres
            ? data.genres.map(
                genre =>
                  genre.name
              )
            : [],

        videos

      }

    });

  }catch(error){

    console.error(
      "Meta error",
      tmdbId,
      error.message
    );

    res.status(500).json({
      error:
        "Unable to load metadata"
    });

  }

}

app.get(
  "/meta/series/tmdb\\::tmdbId.json",
  async (
    req,
    res
  ) => {

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
  async (
    req,
    res
  ) => {

    await sendMeta(
      req,
      res,
      Number(
        req.params.tmdbId
      )
    );

  }
);

app.listen(
  PORT,
  () => {

    console.log(
      "My Shows addon running on port " +
      PORT
    );

  }
);