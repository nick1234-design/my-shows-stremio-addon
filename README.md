
📺 My Shows
A personal Stremio addon for the TV shows you actually watch.
Pick your shows once, and get clean rows on your Stremio home screen that show what's airing next.


� � � � �



✨ Features

Feature
What it does
🎬
My Shows
Your own list of shows, plus an optional second row with a name you choose
⏭️
What's Next?
The upcoming episode for each of your shows, with season, episode and air date
📅
Extra rows
Airing Today, Airing This Week, Recently Aired and Returning Soon
🔀
Sorting
Your own order, next episode, recently aired, or alphabetical
🚫
Hide ended & canceled
Keeps finished shows out of your rows
⏸️
Hide between seasons
Hides returning shows that have no announced next episode
🆔
IMDb IDs option
Lets Stremio's normal show pages (Cinemeta) provide the details
🗓️
Episode calendar
An .ics link you can add to Google Calendar
💾
Backup and restore
Copy your list and paste it back any time
[!NOTE] Your settings are stored in the addon link itself. There's no database and no login.


🧰 What you need
🔑 A free TMDB account and API key
☁️ A free host. These steps use Vercel, but any Node host works
🐙 A free GitHub account to deploy from
💻 Node.js 18 or newer, only if you want to run it locally


🚀 Quick start
Step 1: Get a TMDB API key
Create an account at themoviedb.org.
Go to Settings → API and request a free developer key.
Copy the API Key (the short v3 key, not the long read access token).


Step 2: Add the project files
Put these three files in one GitHub repository:
File
Purpose
server.js
The addon itself
package.json
Lists the dependencies
vercel.json
Tells Vercel how to run the server
📄 package.json
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

📄 vercel.json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}



Step 3: Deploy to Vercel
Sign in at vercel.com and choose Add New → Project.
Import your GitHub repository.
Open Environment Variables and add the values below.
Click Deploy.
Variable
Value
Required
TMDB_API_KEY
Your TMDB API key
✅
TIMEZONE
For example America/New_York (defaults to UTC)
➖
[!IMPORTANT] Never paste your API key into the code or the repository. Use environment variables only.


Step 4: Configure and install
Open your Vercel address, for example https://your-project.vercel.app.
Search for your shows, choose your rows and filters, then tap Install.
Stremio opens and asks you to confirm.
[!TIP] If you change your settings later, copy the new link from the Your Addon card and reinstall. The link changes whenever your settings change.


🎨 Make it your own
What
Where
Default shows for new visitors
The DEFAULT_SHOWS list near the top of server.js
Author name on the configure page
Search server.js for Author
Row names
The catalog section near the manifest in server.js
[!TIP] To find a show's TMDB ID, open its page on themoviedb.org. The number in the address is the ID. For example, themoviedb.org/tv/1399-game-of-thrones is 1399.


🔄 Updating
Edit server.js on GitHub and commit. Vercel redeploys automatically, and your addon link keeps working unless you change your settings.


💻 Run it locally
Show the steps


npm install
TMDB_API_KEY=your_key_here node server.js
Then open http://localhost:3000.
[!NOTE] Stremio on other devices needs an HTTPS address, so for real use deploy it or put a tunnel in front of it.



🛠️ Troubleshooting
"TMDB_API_KEY is not configured"


The environment variable is missing or misspelled. Add it in Vercel and redeploy.

My rows are empty


Check that your show IDs are TMDB TV IDs, and that the ended or between-seasons filters aren't hiding them.

Changes don't show up in Stremio


Responses are cached for about 30 minutes. Wait a bit, or remove and reinstall the addon.

The air dates look wrong


Set the TIMEZONE variable to your own time zone and redeploy.



📜 License
Released under the MIT License.
🙏 Credits
This product uses the TMDB API but is not endorsed or certified by TMDB. Show data and images are provided by TMDB. This project is not affiliated with Stremio.