const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const SHOWS = [
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

app.get("/", (req, res) => {
  res.json({
    status: "online",
    addon: "My Shows",
    shows: SHOWS
  });
});

app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.nick1234.myshows",
    version: "1.1.0",
    name: "My Shows",
    description: "Track upcoming episodes for the shows you're watching.",
    resources: ["catalog", "meta"],
    types: ["series"],
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
});

app.get("/catalog/series/myshows.json", async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res.status(500).json({
        error: "TMDB_API_KEY is not configured"
      });
    }

    const metas = [];

    for (const show of SHOWS) {
      const data = await getShowDetails(show.tmdbId);

      let description = data.overview || "";

      if (data.next_episode_to_air) {
        const next = data.next_episode_to_air;

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
          "\n\n" +
          description;
      }

      metas.push({
        id: "tmdb:" + data.id,
        type: "series",
        name: data.name,
        poster: imageUrl(data.poster_path),
        background: imageUrl(data.backdrop_path, "w1280"),
        description: description
      });
    }

    res.json({
      metas: metas
    });

  } catch (error) {
    console.error(
      error.response ? error.response.data : error.message
    );

    res.status(500).json({
      error: "Failed to load My Shows"
    });
  }
});

app.get("/catalog/series/airingthisweek.json", async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res.status(500).json({
        error: "TMDB_API_KEY is not configured"
      });
    }

    const metas = [];

    for (const show of SHOWS) {
      const data = await getShowDetails(show.tmdbId);

      if (
        data.next_episode_to_air &&
        isWithinNext7Days(data.next_episode_to_air.air_date)
      ) {
        const next = data.next_episode_to_air;

        metas.push({
          id: "tmdb:" + data.id,
          type: "series",
          name: data.name,
          poster: imageUrl(data.poster_path),
          background: imageUrl(data.backdrop_path, "w1280"),
          description:
            "🔥 Airs " +
            formatDate(next.air_date) +
            "\n\n" +
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

  } catch (error) {
    console.error(
      error.response ? error.response.data : error.message
    );

    res.status(500).json({
      error: "Failed to load Airing This Week"
    });
  }
});

app.get("/meta/series/:id.json", async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res.status(500).json({
        error: "TMDB_API_KEY is not configured"
      });
    }

    const id = req.params.id;

    if (!id.startsWith("tmdb:")) {
      return res.status(404).json({
        error: "Unknown show ID"
      });
    }

    const tmdbId = id.replace("tmdb:", "");

    const data = await getShowDetails(tmdbId);

    let seasonNumber = null;

    if (data.next_episode_to_air) {
      seasonNumber = data.next_episode_to_air.season_number;
    } else if (data.last_episode_to_air) {
      seasonNumber = data.last_episode_to_air.season_number;
    } else if (data.number_of_seasons) {
      seasonNumber = data.number_of_seasons;
    }

    let episodes = [];

    if (seasonNumber) {
      episodes = await getSeasonEpisodes(
        tmdbId,
        seasonNumber
      );
    }

    const videos = episodes.map((episode) => {
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

        released: episode.air_date
          ? episode.air_date + "T00:00:00.000Z"
          : new Date().toISOString(),

        thumbnail: imageUrl(
          episode.still_path,
          "w300"
        ),

        season: episode.season_number,

        episode: episode.episode_number,

        overview: episode.overview || ""
      };
    });

    res.json({
      meta: {
        id: "tmdb:" + data.id,
        type: "series",
        name: data.name,
        poster: imageUrl(data.poster_path),
        background: imageUrl(data.backdrop_path, "w1280"),
        description: data.overview || "",
        releaseInfo: data.first_air_date
          ? data.first_air_date.substring(0, 4) + "-"
          : undefined,
        videos: videos
      }
    });

  } catch (error) {
    console.error(
      error.response ? error.response.data : error.message
    );

    res.status(500).json({
      error: "Failed to load show metadata"
    });
  }
});

app.listen(PORT, () => {
  console.log(
    "My Shows addon running on port " + PORT
  );
});
