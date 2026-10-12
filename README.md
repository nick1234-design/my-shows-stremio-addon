My Shows – a personal Stremio addon
A self-hosted Stremio addon for tracking the TV shows you actually watch. Pick your shows on a configure page (works great on a phone) and they appear as rows on your Stremio home screen, powered by TMDB.
Features
My Shows – your own list, plus an optional second row with a name you choose
Sorting – your own order, next episode, recently aired, or alphabetical
What's Next? – the upcoming episode for each of your shows (season, episode, air date)
Optional rows – Airing Today, Airing This Week, Recently Aired, Returning Soon
Hide ended & canceled shows
Hide shows between seasons – hides returning shows that have no announced next episode
IMDb IDs option – lets Stremio's normal show pages (Cinemeta) provide the details
Episode calendar – an .ics link you can add to Google Calendar
Backup and restore your list from the configure page
Your settings live in the addon link itself, so there is no database and nothing to log in to.
What you need
A free TMDB account and API key
A free host. These steps use Vercel, but any Node host works
Node.js 18 or newer (only for running it locally)
A free GitHub account (to deploy from)
1. Get a TMDB API key
Create an account at themoviedb.org.
Go to Settings > API and request a (free) developer key.
Copy the API Key (the short v3 key, not the long read access token).
2. Set up the project files
Put these in one repository:
server.js – the addon
package.json
vercel.json
package.json
{
  "name": "my-shows-addon",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "express": "^4.19.0"
  }
}
vercel.json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
3. Deploy to Vercel
Push the three files to a GitHub repository.
On vercel.com choose Add New > Project and import the repository.
Before deploying, open Environment Variables and add:
Name
Value
TMDB_API_KEY
your TMDB API key (required)
TIMEZONE
e.g. America/New_York (optional, defaults to UTC)
Click Deploy.
Never put your API key in the code or the repository. Use environment variables only.
4. Configure and install
Open your Vercel address in a browser, for example https://your-project.vercel.app.
Search for and add your shows, choose your rows and filters, then tap Install (or copy the link).
Stremio opens and asks you to confirm the install.
If you change settings later, copy the new link from the Your Addon card and reinstall it. The link changes whenever your settings change.
Run it locally (optional)
npm install
TMDB_API_KEY=your_key_here node server.js
Then open http://localhost:3000. Stremio on other devices needs an HTTPS address, so for real use deploy it or put a tunnel in front of it.
Make it your own
Default shows – edit the DEFAULT_SHOWS list near the top of server.js (TMDB IDs). These are what a brand-new visitor starts with.
Author name – search server.js for Author to change the name shown on the configure page.
Rows and names – the catalog names are defined near the manifest section of server.js.
To find a show's TMDB ID, open its page on themoviedb.org. The number in the address is the ID, for example themoviedb.org/tv/1399-game-of-thrones is 1399.
Updating
Edit server.js on GitHub and commit. Vercel redeploys automatically. Your addon link keeps working unless you change your settings.
Troubleshooting
"TMDB_API_KEY is not configured" – the environment variable is missing or misspelled. Add it in Vercel and redeploy.
Empty rows – check that your show IDs are TMDB TV IDs, and that the ended filter isn't hiding them.
Changes don't show up in Stremio – responses are cached for about 30 minutes. Wait, or remove and reinstall the addon.
Wrong air dates – set TIMEZONE to your own time zone.
Credits
This product uses the TMDB API but is not endorsed or certified by TMDB. Show data and images are provided by TMDB. This project is not affiliated with Stremio.