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

function getShowsFromConfig(config) {
  if (!config) {
    return DEFAULT_SHOWS;
  }

  const ids = config
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));

  if (ids.length === 0) {
    return DEFAULT_SHOWS;
  }

  return ids.map((id) => ({
    tmdbId: Number(id)
  }));
}

async function getShowDetails(tmdbId) {
  const response = await axios.get(
    tmdbUrl("/tv/" + tmdbId),
    {
      params: {
        api_key: TMDB_API_KEY
      }
    }
  );

  return response.data;
}

async function getSeasonEpisodes(tmdbId, seasonNumber) {
  const response = await axios.get(
    tmdbUrl("/tv/" + tmdbId + "/season/" + seasonNumber),
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
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>

      <body style="
        font-family:Arial;
        background:#111;
        color:white;
        padding:30px;
        text-align:center;
      ">

        <h1>📺 My Shows</h1>

        <p>Track your favorite TV shows in Stremio.</p>

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

app.get("/configure", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Configure My Shows</title>

<style>

body {
  margin:0;
  background:#101010;
  color:white;
  font-family:Arial,sans-serif;
}

.container {
  max-width:700px;
  margin:auto;
  padding:25px;
}

h1 {
  text-align:center;
}

.subtitle {
  text-align:center;
  color:#aaa;
}

.searchBox {
  display:flex;
  gap:10px;
  margin-top:25px;
}

input {
  flex:1;
  padding:14px;
  border-radius:8px;
  border:1px solid #444;
  background:#202020;
  color:white;
  font-size:16px;
}

button {
  border:0;
  border-radius:8px;
  padding:12px 18px;
  background:#7c4dff;
  color:white;
  font-weight:bold;
  cursor:pointer;
}

button.remove {
  background:#444;
}

.results {
  margin-top:20px;
}

.show {
  display:flex;
  align-items:center;
  gap:15px;
  background:#1c1c1c;
  padding:12px;
  border-radius:10px;
  margin-bottom:10px;
}

.show img {
  width:65px;
  height:95px;
  object-fit:cover;
  border-radius:6px;
}

.showInfo {
  flex:1;
}

.showTitle {
  font-size:17px;
  font-weight:bold;
}

.year {
  color:#aaa;
  margin-top:5px;
}

.selected {
  margin-top:30px;
}

.selectedItem {
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:#1c1c1c;
  padding:12px;
  border-radius:8px;
  margin-bottom:8px;
}

.install {
  width:100%;
  margin-top:25px;
  padding:16px;
  font-size:17px;
  background:#00a86b;
}

.installBox {
  margin-top:20px;
  background:#191919;
  padding:15px;
  border-radius:10px;
  display:none;
}

.installUrl {
  word-break:break-all;
  color:#aaa;
  font-size:13px;
  margin-top:10px;
}

.message {
  text-align:center;
  color:#aaa;
  margin-top:20px;
}

</style>

</head>


<body>

<div class="container">

<h1>📺 My Shows</h1>

<p class="subtitle">
Search for TV shows and add them to your Stremio addon.
</p>


<div class="searchBox">

<input
  id="search"
  placeholder="Search for a TV show..."
/>

<button onclick="searchShows()">
Search
</button>

</div>


<div id="results" class="results"></div>


<div class="selected">

<h2>My Shows</h2>

<div id="selectedShows"></div>

</div>


<button
  class="install"
  onclick="installAddon()"
>
Add My Shows to Stremio
</button>


<div id="installBox" class="installBox">

<strong>Your personalized addon:</strong>

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

let selected = [];


async function searchShows() {

  const query =
    document.getElementById("search").value.trim();

  if (!query) {
    return;
  }

  const results =
    document.getElementById("results");

  results.innerHTML =
    '<div class="message">Searching...</div>';


  try {

    const response =
      await fetch(
        "/api/search?query=" +
        encodeURIComponent(query)
      );

    const data =
      await response.json();


    if (!data.results || data.results.length === 0) {

      results.innerHTML =
        '<div class="message">No shows found.</div>';

      return;
    }


    results.innerHTML =
      data.results.map(show => {

        const poster =
          show.poster ||
          "https://via.placeholder.com/65x95?text=No+Poster";


        const alreadyAdded =
          selected.some(
            item => item.id === show.id
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
              onclick="addShow(\${show.id}, '\${escapeJs(show.name)}')"
              \${alreadyAdded ? "disabled" : ""}
            >
              \${alreadyAdded ? "Added" : "Add"}
            </button>

          </div>
        \`;

      }).join("");


  } catch (error) {

    results.innerHTML =
      '<div class="message">Search failed.</div>';

  }

}


function addShow(id, name) {

  if (
    selected.some(
      show => show.id === id
    )
  ) {
    return;
  }


  selected.push({
    id:id,
    name:name
  });


  renderSelected();

  searchShows();

}


function removeShow(id) {

  selected =
    selected.filter(
      show => show.id !== id
    );

  renderSelected();

  searchShows();

}


function renderSelected() {

  const box =
    document.getElementById("selectedShows");


  if (selected.length === 0) {

    box.innerHTML =
      '<div class="message">No shows added yet.</div>';

    return;
  }


  box.innerHTML =
    selected.map(show => {

      return \`
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
      \`;

    }).join("");

}


function installAddon() {

  if (selected.length === 0) {

    alert(
      "Add at least one show first."
    );

    return;
  }


  const ids =
    selected
      .map(show => show.id)
      .join(",");


  const base =
    window.location.origin;


  const manifestUrl =
    base +
    "/" +
    ids +
    "/manifest.json";


  const stremioUrl =
    "stremio://" +
    manifestUrl.substring(
      "https://".length
    );


  document.getElementById(
    "installUrl"
  ).textContent = manifestUrl;


  document.getElementById(
    "installBox"
  ).style.display = "block";


  window.stremioInstallUrl =
    stremioUrl;

}


function openStremio() {

  if (!window.stremioInstallUrl) {
    return;
  }

  window.location.href =
    window.stremioInstallUrl;

}


function escapeHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function escapeJs(text) {

  return String(text)
    .replace(/\\\\/g, "\\\\\\\\")
    .replace(/'/g, "\\\\'")
    .replace(/"/g, "&quot;");

}


renderSelected();

</script>

</body>

</html>
  `);

});


/*
====================================================
TMDB SEARCH FOR CONFIG PAGE
====================================================
*/

app.get("/api/search", async (req, res) => {

  try {

    if (!TMDB_API_KEY) {

      return res.status(500).json({
        error: "TMDB_API_KEY is not configured"
      });

    }


    const query =
      String(
        req.query.query || ""
      ).trim();


    if (!query) {

      return res.json({
        results:[]
      });

    }


    const response =
      await axios.get(
        tmdbUrl("/search/tv"),
        {
          params: {
            api_key: TMDB_API_KEY,
            query: query,
            language: "en-US",
            include_adult: false
          }
        }
      );


    const results =
      (response.data.results || [])
        .slice(0,20)
        .map(show => {

          return {

            id: show.id,

            name: show.name,

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
      results: results
    });


  } catch (error) {

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error: "Failed to search TV shows"
    });

  }

});


/*
====================================================
MANIFEST
====================================================
*/

async function sendManifest(req, res, config) {

  const shows =
    getShowsFromConfig(config);


  res.json({

    id: "com.nick1234.myshows",

    version: "2.0.1",

    name: "My Shows",

    description:
      "Track upcoming episodes and add shows you're watching.",

    resources: [
      "catalog",
      "meta"
    ],

    types: [
      "series"
    ],

    behaviorHints: {
      configurable: true
    },

    catalogs: [

      {
        type: "series",
        id: "myshows",
        name: "My Shows"
      },

      {
        type: "series",
        id: "airingthisweek",
        name: "Airing This Week"
      }

    ]

  });

}


app.get("/manifest.json", async (req,res) => {

  await sendManifest(
    req,
    res,
    null
  );

});


app.get("/:config/manifest.json", async (req,res) => {

  await sendManifest(
    req,
    res,
    req.params.config
  );

});


/*
====================================================
CATALOG
====================================================
*/

async function sendMyShows(req, res, config) {

  try {

    if (!TMDB_API_KEY) {

      return res.status(500).json({
        error: "TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);


    const metas = [];


    for (const show of shows) {

      const data =
        await getShowDetails(
          show.tmdbId
        );


      let description =
        data.overview || "";


      if (data.next_episode_to_air) {

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
          formatDate(next.air_date) +
          " — " +
          description;

      }


      metas.push({

        id:
          "tmdb:" +
          data.id,

        type:"series",

        name:data.name,

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
      metas: metas
    });


  } catch(error) {

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:"Failed to load My Shows"
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
) {

  try {

    if (!TMDB_API_KEY) {

      return res.status(500).json({
        error:"TMDB_API_KEY is not configured"
      });

    }


    const shows =
      getShowsFromConfig(config);


    const metas = [];


    for (const show of shows) {

      const data =
        await getShowDetails(
          show.tmdbId
        );


      if (
        data.next_episode_to_air &&
        isWithinNext7Days(
          data.next_episode_to_air.air_date
        )
      ) {

        const next =
          data.next_episode_to_air;


        metas.push({

          id:
            "tmdb:" +
            data.id,

          type:"series",

          name:data.name,

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
      metas: metas
    });


  } catch(error) {

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:"Failed to load Airing This Week"
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
META
====================================================
*/

async function sendMeta(
  req,
  res
) {

  try {

    if (!TMDB_API_KEY) {

      return res.status(500).json({
        error:"TMDB_API_KEY is not configured"
      });

    }


    const id =
      req.params.id;


    if (
      !id.startsWith("tmdb:")
    ) {

      return res.status(404).json({
        error:"Unknown show ID"
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


    let seasonNumber = null;


    if (
      data.next_episode_to_air
    ) {

      seasonNumber =
        data.next_episode_to_air.season_number;

    } else if (
      data.last_episode_to_air
    ) {

      seasonNumber =
        data.last_episode_to_air.season_number;

    } else if (
      data.number_of_seasons
    ) {

      seasonNumber =
        data.number_of_seasons;

    }


    let episodes = [];


    if (seasonNumber) {

      episodes =
        await getSeasonEpisodes(
          tmdbId,
          seasonNumber
        );

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

        type:"series",

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
          data.overview || "",

        releaseInfo:
          data.first_air_date
            ? data.first_air_date.substring(0,4) + "-"
            : undefined,

        videos:
          videos

      }

    });


  } catch(error) {

    console.error(
      error.response
        ? error.response.data
        : error.message
    );


    res.status(500).json({
      error:"Failed to load show metadata"
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