const express=require('express');
const axios=require('axios');
const app=express();
const PORT=process.env.PORT||3000;
const TMDB_API_KEY=process.env.TMDB_API_KEY;

const DEFAULT_SHOWS=[
  {name:'The Drop: A Snowfall Saga',tmdbId:304842},
  {name:'MobLand',tmdbId:247718},
  {name:'Anna Pigeon',tmdbId:291350}
];

const DEFAULT_ROWS=['myshows','whatsnext'];

const ALL_ROWS=[
  'myshows',
  'whatsnext',
  'airingthisweek',
  'recentlyaired',
  'returningsoon'
];

const DEFAULT_SORT='myorder';

const ALL_SORTS=[
  'myorder',
  'nextepisode',
  'recentlyaired',
  'alphabetical'
];

app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');

  if(req.method==='OPTIONS'){
    return res.sendStatus(204);
  }

  next();
});

function tmdbUrl(p){
  return 'https://api.themoviedb.org/3'+p;
}

function imageUrl(p,size='w500'){
  return p
    ? 'https://image.tmdb.org/t/p/'+size+p
    : undefined;
}

function formatDate(s){

  if(!s){
    return null;
  }

  return new Date(
    s+'T00:00:00Z'
  ).toLocaleDateString(
    'en-US',
    {
      month:'short',
      day:'numeric',
      year:'numeric',
      timeZone:'UTC'
    }
  );
}

function todayUTC(){

  const d=new Date();

  d.setUTCHours(
    0,
    0,
    0,
    0
  );

  return d;
}

function dayDiff(a,b){

  return Math.round(
    (
      new Date(
        a+'T00:00:00Z'
      ).getTime() -
      new Date(
        b+'T00:00:00Z'
      ).getTime()
    ) / 86400000
  );

}

function isWithinNext7Days(s){

  if(!s){
    return false;
  }

  const t=todayUTC();

  const x=new Date(
    s+'T00:00:00Z'
  );

  const e=new Date(t);

  e.setUTCDate(
    e.getUTCDate()+7
  );

  return x>=t && x<=e;
}

function isRecentlyAired(s){

  if(!s){
    return false;
  }

  const t=todayUTC();

  const x=new Date(
    s+'T00:00:00Z'
  );

  const d=new Date(t);

  d.setUTCDate(
    d.getUTCDate()-7
  );

  return x>=d && x<=t;
}

function isReturningSoon(s){

  if(!s){
    return false;
  }

  const t=todayUTC();

  const x=new Date(
    s+'T00:00:00Z'
  );

  const e=new Date(t);

  e.setUTCDate(
    e.getUTCDate()+7
  );

  return x>e;
}

function daysUntil(s){

  if(!s){
    return null;
  }

  return dayDiff(
    new Date(todayUTC())
      .toISOString()
      .slice(0,10),
    s
  );
}

function getShowPart(config){

  return config
    ? String(config).split('~')[0]
    : '';
}

function getRowsFromConfig(config){

  if(
    !config ||
    !String(config).includes('~')
  ){
    return DEFAULT_ROWS;
  }

  const r=
    (
      String(config).split('~')[1] ||
      ''
    )
      .split(',')
      .map(x=>x.trim())
      .filter(x=>ALL_ROWS.includes(x));

  return r.length
    ? r
    : DEFAULT_ROWS;
}

function getSortFromConfig(config){

  if(
    !config ||
    !String(config).includes('~')
  ){
    return DEFAULT_SORT;
  }

  const s=
    String(config)
      .split('~')[2] ||
      '';

  return ALL_SORTS.includes(
    s.trim()
  )
    ? s.trim()
    : DEFAULT_SORT;
}

function getShowsFromConfig(config){

  if(!config){
    return DEFAULT_SHOWS;
  }

  const ids=
    getShowPart(config)
      .split(',')
      .map(x=>x.trim())
      .filter(
        x=>/^\d+$/.test(x)
      );

  return ids.length
    ? ids.map(
        id=>({
          tmdbId:Number(id)
        })
      )
    : DEFAULT_SHOWS;
}

async function getShowDetails(id){

  const r=
    await axios.get(
      tmdbUrl('/tv/'+id),
      {
        params:{
          api_key:TMDB_API_KEY
        }
      }
    );

  return r.data;
}

async function getSeasonEpisodes(
  id,
  n
){

  const r=
    await axios.get(
      tmdbUrl(
        '/tv/'+
        id+
        '/season/'+
        n
      ),
      {
        params:{
          api_key:TMDB_API_KEY
        }
      }
    );

  return r.data.episodes || [];
}


/*
====================================================
SMART SORTING
====================================================
*/

function sortMyShows(
  items,
  sort
){

  if(sort==='alphabetical'){

    return items.sort(
      (a,b)=>
        a.data.name.localeCompare(
          b.data.name
        ) ||
        a.originalIndex-
        b.originalIndex
    );

  }

  if(sort==='nextepisode'){

    return items.sort(
      (a,b)=>
        (
          a.nextTime ??
          Number.MAX_SAFE_INTEGER
        ) -
        (
          b.nextTime ??
          Number.MAX_SAFE_INTEGER
        ) ||
        a.originalIndex-
        b.originalIndex
    );

  }

  if(sort==='recentlyaired'){

    return items.sort(
      (a,b)=>
        (
          b.lastTime ??
          0
        ) -
        (
          a.lastTime ??
          0
        ) ||
        a.originalIndex-
        b.originalIndex
    );

  }

  return items.sort(
    (a,b)=>
      a.originalIndex-
      b.originalIndex
  );

}


/*
====================================================
HOME
====================================================
*/

app.get(
  '/',
  (req,res)=>
    res.send(
      '<html>'+
      '<body style="font-family:Arial;background:#111;color:white;padding:30px;text-align:center">'+
      '<h1>📺 My Shows</h1>'+
      '<p>Track your favorite TV shows in Stremio.</p>'+
      '<a href="/configure" style="display:inline-block;padding:14px 22px;background:#7c4dff;color:white;text-decoration:none;border-radius:10px">'+
      'Configure My Shows'+
      '</a>'+
      '</body>'+
      '</html>'
    )
);


/*
====================================================
CONFIGURE
====================================================
*/

async function sendConfigure(
  req,
  res,
  config
){

  const configString=
    String(config||'');

  const initialIds=
    getShowPartFromConfig(
      configString
    )
      .split(',')
      .map(
        x=>Number(x.trim())
      )
      .filter(
        x=>
          Number.isInteger(x) &&
          x>0
      );

  const initialRows=
    getRowsFromConfig(
      configString
    );

  const initialSort=
    getSortFromConfig(
      configString
    );

  res.send(
String.raw`<!DOCTYPE html>
<html>

<head>

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>Configure My Shows</title>

<style>

body{
  margin:0;
  background:#101010;
  color:#fff;
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

input[type=text]{
  flex:1;
  padding:14px;
  border-radius:8px;
  border:1px solid #444;
  background:#202020;
  color:#fff;
  font-size:16px
}

button{
  border:0;
  border-radius:8px;
  padding:12px 18px;
  background:#7c4dff;
  color:#fff;
  font-weight:bold
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
  cursor:pointer
}

.slider:before{
  content:"";
  position:absolute;
  width:22px;
  height:22px;
  left:4px;
  top:4px;
  background:#fff;
  border-radius:50%
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
  margin:5px 0 12px
}

.sortBox select{
  width:100%;
  padding:12px;
  border-radius:8px;
  border:1px solid #444;
  background:#202020;
  color:#fff;
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

let selected=[];

function applyInitialRows(){

  ${JSON.stringify(ALL_ROWS)}.forEach(
    id=>{

      const e=
        document.getElementById(
          'row_'+id
        );

      if(e){
        e.checked=
          initialRows.includes(id);
      }

    }
  );

}

function applyInitialSort(){

  document.getElementById(
    'sortOrder'
  ).value=
    initialSort;

}

function escapeHtml(s){

  return String(s)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}

async function searchShows(){

  const q=
    document
      .getElementById('search')
      .value
      .trim();

  if(!q){
    return;
  }

  const box=
    document.getElementById(
      'results'
    );

  box.innerHTML=
    '<div class="message">Searching...</div>';

  try{

    const r=
      await fetch(
        '/api/search?query='+
        encodeURIComponent(q)
      );

    const d=
      await r.json();

    if(
      !d.results ||
      !d.results.length
    ){

      box.innerHTML=
        '<div class="message">No shows found.</div>';

      return;

    }

    box.innerHTML=
      d.results
        .map(
          s=>{

            const added=
              selected.some(
                x=>x.id===s.id
              );

            const safeName=
              String(s.name)
                .replace(
                  /\\\\/g,
                  '\\\\\\\\'
                )
                .replace(
                  /'/g,
                  "\\'"
                );

            return
              '<div class="show">'+
              '<img src="'+
              (s.poster||'')+
              '">'+
              '<div class="showInfo">'+
              '<div class="showTitle">'+
              escapeHtml(s.name)+
              '</div>'+
              '<div class="year">'+
              (s.year||'')+
              '</div>'+
              '</div>'+
              '<button '+
              (
                added
                  ? 'disabled'
                  : ''
              )+
              ' onclick="addShow('+
              s.id+
              ',\\''+
              safeName+
              '\\')">'+
              (
                added
                  ? 'Added'
                  : 'Add'
              )+
              '</button>'+
              '</div>';

          }
        )
        .join('');

  }catch(e){

    box.innerHTML=
      '<div class="message">Search failed.</div>';

  }

}

function addShow(
  id,
  name
){

  if(
    selected.some(
      x=>x.id===id
    )
  ){
    return;
  }

  selected.push({
    id,
    name
  });

  renderSelected();
  searchShows();

}

function removeShow(id){

  selected=
    selected.filter(
      x=>x.id!==id
    );

  renderSelected();
  searchShows();

}

function renderSelected(){

  const box=
    document.getElementById(
      'selectedShows'
    );

  if(!selected.length){

    box.innerHTML=
      '<div class="message">No shows added yet.</div>';

    return;

  }

  box.innerHTML=
    selected
      .map(
        s=>
          '<div class="selectedItem">'+
          '<span>'+
          escapeHtml(s.name)+
          '</span>'+
          '<button class="remove" onclick="removeShow('+
          s.id+
          ')">Remove</button>'+
          '</div>'
      )
      .join('');

}

function installAddon(){

  if(!selected.length){

    alert(
      'Add at least one show first.'
    );

    return;

  }

  const ids=
    selected
      .map(
        x=>x.id
      )
      .join(',');

  const rows=
    ${JSON.stringify(ALL_ROWS)}
      .filter(
        x=>
          document.getElementById(
            'row_'+x
          ).checked
      );

  const sort=
    document.getElementById(
      'sortOrder'
    ).value;

  if(!rows.length){

    alert(
      'Choose at least one Home row.'
    );

    return;

  }

  const config=
    ids+
    '~'+
    rows.join(',')+
    '~'+
    sort;

  const manifestUrl=
    location.origin+
    '/'+
    config+
    '/manifest.json';

  document.getElementById(
    'installUrl'
  ).textContent=
    manifestUrl;

  document.getElementById(
    'installBox'
  ).style.display=
    'block';

  window.stremioInstallUrl=
    'stremio://'+
    manifestUrl.replace(
      /^https?:\\/\\//,
      ''
    );

}

function openStremio(){

  if(
    window.stremioInstallUrl
  ){

    location.href=
      window.stremioInstallUrl;

  }

}

async function loadExistingShows(){

  if(!initialIds.length){

    renderSelected();

    return;

  }

  try{

    const r=
      await fetch(
        '/api/shows?ids='+
        initialIds.join(',')
      );

    const d=
      await r.json();

    selected=
      (d.results||[])
        .map(
          s=>({
            id:s.id,
            name:s.name
          })
        );

  }catch(e){

    console.error(e);

  }

  renderSelected();

}

applyInitialRows();

applyInitialSort();

loadExistingShows();

</script>

</body>

</html>`
  );

}

app.get(
  '/configure',
  (req,res)=>
    sendConfigure(
      req,
      res,
      null
    )
);

app.get(
  '/:config/configure',
  (req,res)=>
    sendConfigure(
      req,
      res,
      req.params.config
    )
);


/*
====================================================
SEARCH
====================================================
*/

app.get(
  '/api/search',
  async(req,res)=>{

    try{

      const q=
        String(
          req.query.query||''
        ).trim();

      if(!q){

        return res.json({
          results:[]
        });

      }

      const r=
        await axios.get(
          tmdbUrl('/search/tv'),
          {
            params:{
              api_key:
                TMDB_API_KEY,

              query:
                q,

              language:
                'en-US',

              include_adult:
                false
            }
          }
        );

      res.json({

        results:
          (r.data.results||[])
            .slice(0,20)
            .map(
              s=>({

                id:
                  s.id,

                name:
                  s.name,

                year:
                  s.first_air_date
                    ? s.first_air_date.slice(0,4)
                    : '',

                poster:
                  imageUrl(
                    s.poster_path
                  ),

                overview:
                  s.overview||''

              })
            )

      });

    }catch(e){

      console.error(
        e.response?.data||
        e.message
      );

      res.status(500).json({
        error:
          'Failed to search TV shows'
      });

    }

  }
);


/*
====================================================
LOAD CONFIGURED SHOWS
====================================================
*/

app.get(
  '/api/shows',
  async(req,res)=>{

    try{

      const ids=
        String(
          req.query.ids||''
        )
          .split(',')
          .map(
            x=>x.trim()
          )
          .filter(
            x=>/^\d+$/.test(x)
          );

      const results=[];

      for(
        const id of ids
      ){

        try{

          const d=
            await getShowDetails(
              id
            );

          results.push({

            id:
              Number(id),

            name:
              d.name

          });

        }catch(e){

          console.error(
            'Failed to load show '+id
          );

        }

      }

      res.json({
        results
      });

    }catch(e){

      res.status(500).json({
        error:
          'Failed to load existing shows'
      });

    }

  }
);


/*
====================================================
MANIFEST
====================================================
*/

function buildManifest(config){

  const names={

    myshows:
      'My Shows',

    whatsnext:
      "What's Next?",

    airingthisweek:
      'Airing This Week',

    recentlyaired:
      'Recently Aired',

    returningsoon:
      'Returning Soon'

  };

  return{

    id:
      'com.nick1234.myshows',

    version:
      '2.4.0',

    name:
      'My Shows',

    description:
      "Track upcoming episodes and add shows you're watching.",

    resources:[
      'catalog',
      'meta'
    ],

    types:[
      'series'
    ],

    catalogs:
      getRowsFromConfig(
        config
      ).map(
        id=>({

          type:
            'series',

          id,

          name:
            names[id]||id

        })
      ),

    behaviorHints:{
      configurable:
        true
    }

  };

}

app.get(
  '/manifest.json',
  (req,res)=>
    res.json(
      buildManifest(null)
    )
);

app.get(
  '/:config/manifest.json',
  (req,res)=>
    res.json(
      buildManifest(
        req.params.config
      )
    )
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

    const shows=
      getShowsFromConfig(
        config
      );

    const items=[];

    for(
      let i=0;
      i<shows.length;
      i++
    ){

      try{

        const d=
          await getShowDetails(
            shows[i].tmdbId
          );

        const n=
          d.next_episode_to_air;

        const l=
          d.last_episode_to_air;

        items.push({

          data:
            d,

          originalIndex:
            i,

          nextTime:
            n?.air_date
              ? new Date(
                  n.air_date+
                  'T00:00:00Z'
                ).getTime()
              : null,

          lastTime:
            l?.air_date
              ? new Date(
                  l.air_date+
                  'T00:00:00Z'
                ).getTime()
              : null

        });

      }catch(e){

        console.error(
          'Failed to load '+
          shows[i].tmdbId,
          e.response?.data||
          e.message
        );

      }

    }

    sortMyShows(
      items,
      getSortFromConfig(
        config
      )
    );

    res.json({

      metas:
        items.map(
          ({data:d})=>({

            id:
              'tmdb:'+d.id,

            type:
              'series',

            name:
              d.name,

            poster:
              imageUrl(
                d.poster_path
              ),

            background:
              imageUrl(
                d.backdrop_path,
                'w1280'
              ),

            description:
              d.next_episode_to_air
                ? 'Next Episode: S'+
                  d.next_episode_to_air.season_number+
                  ' E'+
                  d.next_episode_to_air.episode_number+
                  ' — '+
                  d.next_episode_to_air.name+
                  '\nAirs: '+
                  formatDate(
                    d.next_episode_to_air.air_date
                  )
                : ''

          })
        )

    });

  }catch(e){

    console.error(
      e.response?.data||
      e.message
    );

    res.status(500).json({
      error:
        'Failed to load My Shows'
    });

  }

}

app.get(
  '/catalog/series/myshows.json',
  (req,res)=>
    sendMyShows(
      req,
      res,
      null
    )
);

app.get(
  '/:config/catalog/series/myshows.json',
  (req,res)=>
    sendMyShows(
      req,
      res,
      req.params.config
    )
);


/*
====================================================
AIRING THIS WEEK
====================================================
*/

async function sendAiring(
  req,
  res,
  config
){

  try{

    const out=[];

    for(
      const s of
      getShowsFromConfig(
        config
      )
    ){

      try{

        const d=
          await getShowDetails(
            s.tmdbId
          );

        const n=
          d.next_episode_to_air;

        if(
          n &&
          isWithinNext7Days(
            n.air_date
          )
        ){

          out.push({
            d,
            n
          });

        }

      }catch(e){}

    }

    out.sort(
      (a,b)=>
        new Date(
          a.n.air_date
        )-
        new Date(
          b.n.air_date
        )
    );

    res.json({

      metas:
        out.map(
          ({d,n})=>({

            id:
              'tmdb:'+d.id,

            type:
              'series',

            name:
              d.name,

            poster:
              imageUrl(
                d.poster_path
              ),

            background:
              imageUrl(
                d.backdrop_path,
                'w1280'
              ),

            description:
              '🔥 Airs '+
              formatDate(
                n.air_date
              )+
              '\n\nSeason '+
              n.season_number+
              ', Episode '+
              n.episode_number+
              ': '+
              n.name

          })
        )

    });

  }catch(e){

    res.status(500).json({
      error:
        'Failed to load Airing This Week'
    });

  }

}

app.get(
  '/catalog/series/airingthisweek.json',
  (req,res)=>
    sendAiring(
      req,
      res,
      null
    )
);

app.get(
  '/:config/catalog/series/airingthisweek.json',
  (req,res)=>
    sendAiring(
      req,
      res,
      req.params.config
    )
);


/*
====================================================
WHAT'S NEXT
====================================================
*/

async function sendNext(
  req,
  res,
  config
){

  try{

    const out=[];

    for(
      const s of
      getShowsFromConfig(
        config
      )
    ){

      try{

        const d=
          await getShowDetails(
            s.tmdbId
          );

        const n=
          d.next_episode_to_air;

        if(
          n &&
          n.air_date
        ){

          out.push({
            d,
            n
          });

        }

      }catch(e){}

    }

    out.sort(
      (a,b)=>
        new Date(
          a.n.air_date
        )-
        new Date(
          b.n.air_date
        )
    );

    res.json({

      metas:
        out.map(
          ({d,n})=>({

            id:
              'tmdb:'+d.id,

            type:
              'series',

            name:
              d.name,

            poster:
              imageUrl(
                d.poster_path
              ),

            background:
              imageUrl(
                d.backdrop_path,
                'w1280'
              ),

            description:
              '⏭️ Next Episode: S'+
              n.season_number+
              ' E'+
              n.episode_number+
              ' — '+
              n.name+
              '\n📅 Airs '+
              formatDate(
                n.air_date
              )

          })
        )

    });

  }catch(e){

    res.status(500).json({
      error:
        "Failed to load What's Next"
    });

  }

}

app.get(
  '/catalog/series/whatsnext.json',
  (req,res)=>
    sendNext(
      req,
      res,
      null
    )
);

app.get(
  '/:config/catalog/series/whatsnext.json',
  (req,res)=>
    sendNext(
      req,
      res,
      req.params.config
    )
);


/*
====================================================
RECENTLY AIRED
====================================================
*/

function daysSince(s){

  return dayDiff(
    new Date(
      todayUTC()
    )
      .toISOString()
      .slice(0,10),
    s
  );

}

async function sendRecently(
  req,
  res,
  config
){

  try{

    const out=[];

    for(
      const s of
      getShowsFromConfig(
        config
      )
    ){

      try{

        const d=
          await getShowDetails(
            s.tmdbId
          );

        const e=
          d.last_episode_to_air;

        if(
          e &&
          e.air_date &&
          isRecentlyAired(
            e.air_date
          )
        ){

          out.push({

            d,
            e,

            t:
              new Date(
                e.air_date+
                'T00:00:00Z'
              ).getTime()

          });

        }

      }catch(e){}

    }

    out.sort(
      (a,b)=>
        b.t-a.t
    );

    res.json({

      metas:
        out.map(
          ({d,e})=>{

            const n=
              daysSince(
                e.air_date
              );

            return{

              id:
                'tmdb:'+d.id,

              type:
                'series',

              name:
                d.name,

              poster:
                imageUrl(
                  d.poster_path
                ),

              background:
                imageUrl(
                  d.backdrop_path,
                  'w1280'
                ),

              description:
                '🆕 S'+
                e.season_number+
                ' E'+
                e.episode_number+
                ' — '+
                e.name+
                '\n📅 Aired '+
                (
                  n===0
                    ? 'today'
                    : n===1
                      ? 'yesterday'
                      : n+' days ago'
                )

            };

          }
        )

    });

  }catch(e){

    res.status(500).json({
      error:
        'Failed to load Recently Aired'
    });

  }

}

app.get(
  '/catalog/series/recentlyaired.json',
  (req,res)=>
    sendRecently(
      req,
      res,
      null
    )
);

app.get(
  '/:config/catalog/series/recentlyaired.json',
  (req,res)=>
    sendRecently(
      req,
      res,
      req.params.config
    )
);


/*
====================================================
RETURNING SOON
====================================================
*/

async function sendReturning(
  req,
  res,
  config
){

  try{

    const out=[];

    for(
      const s of
      getShowsFromConfig(
        config
      )
    ){

      try{

        const d=
          await getShowDetails(
            s.tmdbId
          );

        const n=
          d.next_episode_to_air;

        if(
          n &&
          n.air_date &&
          isReturningSoon(
            n.air_date
          )
        ){

          out.push({

            d,
            n,

            t:
              new Date(
                n.air_date+
                'T00:00:00Z'
              ).getTime()

          });

        }

      }catch(e){}

    }

    out.sort(
      (a,b)=>
        a.t-b.t
    );

    res.json({

      metas:
        out.map(
          ({d,n})=>{

            const days=
              daysUntil(
                n.air_date
              );

            return{

              id:
                'tmdb:'+d.id,

              type:
                'series',

              name:
                d.name,

              poster:
                imageUrl(
                  d.poster_path
                ),

              background:
                imageUrl(
                  d.backdrop_path,
                  'w1280'
                ),

              description:
                '🔄 Returning '+
                formatDate(
                  n.air_date
                )+
                '\nSeason '+
                n.season_number+
                ' • Episode '+
                n.episode_number+
                ': '+
                n.name+
                '\n📅 In '+
                days+
                ' day'+
                (
                  days===1
                    ? ''
                    : 's'
                )

            };

          }
        )

    });

  }catch(e){

    res.status(500).json({
      error:
        'Failed to load Returning Soon'
    });

  }

}

app.get(
  '/catalog/series/returningsoon.json',
  (req,res)=>
    sendReturning(
      req,
      res,
      null
    )
);

app.get(
  '/:config/catalog/series/returningsoon.json',
  (req,res)=>
    sendReturning(
      req,
      res,
      req.params.config
    )
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

    const id=
      req.params.id;

    if(
      !id.startsWith('tmdb:')
    ){

      return res.status(404).json({
        error:
          'Unknown show ID'
      });

    }

    const tmdbId=
      id.slice(5);

    const d=
      await getShowDetails(
        tmdbId
      );

    let episodes=[];

    const seasons=
      (d.seasons||[])
        .filter(
          s=>
            s.season_number>0
        )
        .sort(
          (a,b)=>
            a.season_number-
            b.season_number
        );

    for(
      const s of seasons
    ){

      try{

        episodes.push(
          ...await getSeasonEpisodes(
            tmdbId,
            s.season_number
          )
        );

      }catch(e){

        console.error(
          'Season load failed',
          s.season_number
        );

      }

    }

    const videos=
      episodes.map(
        e=>({

          id:
            'tmdb:'+
            tmdbId+
            ':'+
            e.season_number+
            ':'+
            e.episode_number,

          title:
            'S'+
            e.season_number+
            ' E'+
            e.episode_number+
            ' - '+
            e.name,

          released:
            e.air_date
              ? e.air_date+
                'T12:00:00.000Z'
              : new Date().toISOString(),

          thumbnail:
            imageUrl(
              e.still_path,
              'w300'
            ),

          season:
            e.season_number,

          episode:
            e.episode_number,

          overview:
            e.overview||''

        })
      );


    /*
    STATUS
    */

    let status='';

    if(
      d.status==='Ended'
    ){

      status=
        '🔴 Ended';

    }else if(
      d.status==='Canceled'
    ){

      status=
        '🔴 Canceled';

    }else if(
      d.status==='Returning Series' &&
      d.next_episode_to_air
    ){

      const n=
        d.next_episode_to_air;

      status=
        '🟢 Currently Airing\n'+
        'Next Episode: S'+
        n.season_number+
        ' E'+
        n.episode_number+
        ' — '+
        n.name+
        '\nAirs: '+
        formatDate(
          n.air_date
        );

    }else if(
      d.status==='Returning Series'
    ){

      status=
        '🔵 Returning Series';

    }else if(
      d.status==='In Production'
    ){

      status=
        '🟡 In Production';

    }else if(
      d.status==='Planned'
    ){

      status=
        '⚪ Planned';

    }


    /*
    SEASON PROGRESS
    */

    const today=
      todayUTC();

    const aired=
      episodes.filter(
        e=>
          e.air_date &&
          new Date(
            e.air_date+
            'T00:00:00Z'
          )<=today
      );

    let progressSeason=null;

    if(
      d.next_episode_to_air
    ){

      progressSeason=
        d.next_episode_to_air
          .season_number;

    }else if(
      aired.length
    ){

      progressSeason=
        Math.max(
          ...aired.map(
            e=>
              e.season_number
          )
        );

    }else if(
      seasons.length
    ){

      progressSeason=
        seasons[
          seasons.length-1
        ].season_number;

    }

    let progress='';

    if(
      progressSeason!==null
    ){

      const seasonEpisodes=
        episodes.filter(
          e=>
            e.season_number===
            progressSeason
        );

      const seasonAired=
        seasonEpisodes.filter(
          e=>
            e.air_date &&
            new Date(
              e.air_date+
              'T00:00:00Z'
            )<=today
        );

      if(
        seasonEpisodes.length
      ){

        progress=
          '📊 Season '+
          progressSeason+
          ' — '+
          seasonAired.length+
          ' of '+
          seasonEpisodes.length+
          ' episodes aired';

      }

    }

    res.json({

      meta:{

        id:
          'tmdb:'+d.id,

        type:
          'series',

        name:
          d.name,

        poster:
          imageUrl(
            d.poster_path
          ),

        background:
          imageUrl(
            d.backdrop_path,
            'w1280'
          ),

        description:
          [
            status,
            progress,
            d.overview||''
          ]
            .filter(Boolean)
            .join('\n\n'),

        releaseInfo:
          d.first_air_date
            ? d.first_air_date.slice(0,4)+'-'
            : undefined,

        videos

      }

    });

  }catch(e){

    console.error(
      e.response?.data||
      e.message
    );

    res.status(500).json({
      error:
        'Failed to load show metadata'
    });

  }

}


/*
====================================================
META ROUTES
====================================================
*/

app.get(
  '/meta/series/:id.json',
  sendMeta
);

app.get(
  '/:config/meta/series/:id.json',
  sendMeta
);


/*
====================================================
START
====================================================
*/

app.listen(
  PORT,
  ()=>{
    console.log(
      'My Shows addon running on port '+
      PORT
    );
  }
);