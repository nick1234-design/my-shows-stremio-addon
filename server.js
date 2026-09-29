const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// We'll put the exact TMDB IDs here after verifying the 3 shows.
const SHOWS = [
  {
    name: "The Drop: A Snowfall Saga",
    tmdbId: null
  },
  {
    name: "MobLand",
    tmdbId: null
  },
  {
    name: "Ana Pigeon",
    tmdbId: null
  }
];

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
    version: "1.0.0",
    name: "My Shows",
    description: "Track upcoming episodes for the shows you're watching.",
    logo: "https://www.google.com/s2/favicons?domain=themoviedb.org&sz=128",
    resources: [
      "catalog",
      "meta"
    ],
    types: [
      "series"
    ],
    catalogs: [
      {
        type: "series",
        id: "myshows",
        name: "📺 My Shows"
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
      if (!show.tmdbId) continue;

      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${show.tmdbId}`,
        {
          params: {
            api_key: TMDB_API_KEY
          }
        }
      );

      const data = response.data;

      metas.push({
        id: `tmdb:${data.id}`,
        type: "series",
        name: data.name,
        poster: data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : undefined,
        description: data.overview || ""
      });
    }

    res.json({
      metas
    });

  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: "Failed to load shows"
    });
  }
});

app.listen(PORT, () => {
  console.log(`My Shows addon running on port ${PORT}`);
});