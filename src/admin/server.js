import Fastify from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import config from '../config.js'
import { getStats, addEventListener, removeEventListener } from '../logger.js'

function checkAuth(request, reply) {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Basic ')) {
    reply.code(401).header('WWW-Authenticate', 'Basic realm="OpenClaw Admin"').send({ error: 'unauthorized' })
    return false
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString()
  const [user, pass] = decoded.split(':')
  if (user !== config.adminUsername || pass !== config.adminPassword) {
    reply.code(401).header('WWW-Authenticate', 'Basic realm="OpenClaw Admin"').send({ error: 'unauthorized' })
    return false
  }
  return true
}

function readEvents(date, category, limit) {
  const filePath = join(config.dataDir, 'attacks', `${date}.jsonl`)
  if (!existsSync(filePath)) return []
  const lines = readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean)
  let events = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  if (category) {
    events = events.filter(e => e.category === category)
  }
  if (limit) {
    events = events.slice(-limit)
  }
  return events
}

function readSession(dir, id) {
  const filePath = join(config.dataDir, dir, `${id}.jsonl`)
  if (!existsSync(filePath)) return []
  return readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

export async function createAdminServer(opts = {}) {
  const app = Fastify({ logger: false })
  const bindPort = opts.port || config.adminPort
  const bindHost = opts.host || config.adminHost

  // Auth hook for all routes
  app.addHook('onRequest', async (request, reply) => {
    if (!checkAuth(request, reply)) return reply
  })

  // Dashboard HTML
  app.get('/', (request, reply) => {
    reply.type('text/html; charset=utf-8').send(getDashboardHtml())
  })

  // API: stats
  app.get('/admin/api/stats', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(getStats())
  })

  // API: events
  app.get('/admin/api/events', (request, reply) => {
    const date = request.query.date || new Date().toISOString().slice(0, 10)
    const category = request.query.category || null
    const limit = parseInt(request.query.limit || '100', 10)
    reply.type('application/json; charset=utf-8').send(readEvents(date, category, limit))
  })

  // API: SSE live feed
  app.get('/admin/api/events/stream', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const handler = (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    addEventListener(handler)
    request.raw.on('close', () => {
      removeEventListener(handler)
    })
  })

  // API: geo markers
  app.get('/admin/api/geo/markers', (request, reply) => {
    const date = request.query.date || new Date().toISOString().slice(0, 10)
    const category = request.query.category || null
    const events = readEvents(date, category, null)
    const byIP = new Map()
    for (const e of events) {
      if (!e.geo || !e.geo.latitude) continue
      const key = e.source_ip
      if (!byIP.has(key)) {
        byIP.set(key, { lat: e.geo.latitude, lon: e.geo.longitude, ip: key, country: e.geo.country, city: e.geo.city, asn: e.geo.asn, asnOrg: e.geo.asnOrg, count: 0, categories: new Set() })
      }
      const m = byIP.get(key)
      m.count++
      m.categories.add(e.category)
    }
    const markers = [...byIP.values()].map(m => ({ ...m, categories: [...m.categories] }))
    reply.type('application/json; charset=utf-8').send(markers)
  })

  // API: geo countries
  app.get('/admin/api/geo/countries', (request, reply) => {
    const stats = getStats()
    const countries = Object.entries(stats.byCountry || {}).map(([country, count]) => ({
      country, countryName: country, count, uniqueIPs: 0,
    }))
    reply.type('application/json; charset=utf-8').send(countries)
  })

  // API: WS session
  app.get('/admin/api/ws-session/:id', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(readSession('ws-sessions', request.params.id))
  })

  // API: CDP session
  app.get('/admin/api/cdp-session/:id', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(readSession('cdp-sessions', request.params.id))
  })

  await app.listen({ host: bindHost, port: bindPort })
  console.log(`[admin] Dashboard on ${bindHost}:${bindPort}`)
  return app
}

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenClaw Honeypot — Admin</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",monospace;font-size:14px}
.tabs{display:flex;gap:0;border-bottom:1px solid #30363d;padding:0 1rem;background:#161b22}
.tab{padding:10px 18px;cursor:pointer;border:none;background:none;color:#8b949e;font-size:13px;border-bottom:2px solid transparent}
.tab.active{color:#58a6ff;border-bottom-color:#58a6ff}
.tab:hover{color:#c9d1d9}
.panel{display:none;padding:1rem;max-height:calc(100vh - 42px);overflow-y:auto}
.panel.active{display:block}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #21262d;font-size:13px}
th{color:#8b949e;font-weight:600}
tr:hover{background:#161b22}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.badge-scan{background:#1f3d2a;color:#3fb950}
.badge-recon{background:#2a2d1f;color:#d29922}
.badge-exploit{background:#3d1f1f;color:#f85149}
.badge-rce_attempt{background:#3d1f2a;color:#ff7b72}
.badge-prompt_injection{background:#2a1f3d;color:#bc8cff}
.badge-proxy_abuse{background:#1f2a3d;color:#79c0ff}
.badge-cdp_exploit{background:#3d2a1f;color:#ffa657}
.badge-webhook_injection{background:#1f3d3d;color:#56d4dd}
.stat-card{display:inline-block;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px 20px;margin:4px;min-width:120px}
.stat-card .val{font-size:24px;font-weight:700;color:#58a6ff}
.stat-card .label{font-size:11px;color:#8b949e;margin-top:4px}
#live-feed{max-height:70vh;overflow-y:auto}
.feed-entry{padding:6px 10px;border-bottom:1px solid #21262d;font-family:monospace;font-size:12px}
.feed-entry:hover{background:#161b22}
.ts{color:#8b949e}
.ip{color:#58a6ff}
.method{color:#d2a8ff}
.path{color:#7ee787}
#map{height:60vh;border-radius:6px;border:1px solid #30363d;margin-top:1rem}
h2{font-size:16px;color:#e6edf3;margin-bottom:8px}
</style>
</head>
<body>
<div class="tabs">
<div class="tab active" data-panel="feed">Live Feed</div>
<div class="tab" data-panel="stats">Statistics</div>
<div class="tab" data-panel="map">Geo Map</div>
<div class="tab" data-panel="ws">WS Sessions</div>
<div class="tab" data-panel="pi">Prompt Injection</div>
<div class="tab" data-panel="canary">Canary Alerts</div>
<div class="tab" data-panel="top">Top Attackers</div>
</div>

<div id="feed" class="panel active">
<h2>Live Event Feed</h2>
<div id="live-feed"></div>
</div>

<div id="stats" class="panel">
<h2>Statistics</h2>
<div id="stat-cards"></div>
<h2 style="margin-top:1rem">By Category</h2>
<table id="cat-table"><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody></tbody></table>
<h2>By Port</h2>
<table id="port-table"><thead><tr><th>Port</th><th>Count</th></tr></thead><tbody></tbody></table>
<h2>By Country</h2>
<table id="country-table"><thead><tr><th>Country</th><th>Count</th></tr></thead><tbody></tbody></table>
<h2>Top User Agents</h2>
<table id="ua-table"><thead><tr><th>User-Agent</th><th>Count</th></tr></thead><tbody></tbody></table>
</div>

<div id="map" class="panel">
<h2>Geographic Map</h2>
<div id="mapview"></div>
</div>

<div id="ws" class="panel">
<h2>WebSocket Sessions</h2>
<div id="ws-list"></div>
</div>

<div id="pi" class="panel">
<h2>Prompt Injection Attempts</h2>
<table id="pi-table"><thead><tr><th>Time</th><th>IP</th><th>Content</th></tr></thead><tbody></tbody></table>
</div>

<div id="canary" class="panel">
<h2>Canary Alerts</h2>
<table id="canary-table"><thead><tr><th>Key (truncated)</th><th>Used At</th><th>From IP</th></tr></thead><tbody></tbody></table>
</div>

<div id="top" class="panel">
<h2>Top Attackers</h2>
<table id="top-table"><thead><tr><th>IP</th><th>Count</th><th>Categories</th><th>Country</th><th>ASN</th></tr></thead><tbody></tbody></table>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
const tabs=document.querySelectorAll('.tab');
const panels=document.querySelectorAll('.panel');
tabs.forEach(t=>t.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.remove('active'));
  panels.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.panel).classList.add('active');
  if(t.dataset.panel==='stats')loadStats();
  if(t.dataset.panel==='map')initMap();
  if(t.dataset.panel==='pi')loadPI();
  if(t.dataset.panel==='canary')loadCanary();
  if(t.dataset.panel==='top')loadTop();
}));

function badge(cat){return '<span class="badge badge-'+cat+'">'+cat+'</span>'}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

// Live feed SSE
const es=new EventSource('/admin/api/events/stream');
const feed=document.getElementById('live-feed');
es.onmessage=e=>{
  const ev=JSON.parse(e.data);
  const div=document.createElement('div');
  div.className='feed-entry';
  div.innerHTML='<span class="ts">'+ev.timestamp?.slice(11,19)+'</span> '+
    '<span class="ip">'+esc(ev.source_ip||'-')+'</span> '+
    '<span class="method">'+esc(ev.method||'-')+'</span> '+
    '<span class="path">'+esc(ev.path||'')+'</span> '+
    badge(ev.category||'scan');
  feed.prepend(div);
  if(feed.children.length>500)feed.lastChild.remove();
};

async function loadStats(){
  const r=await fetch('/admin/api/stats');
  const s=await r.json();
  document.getElementById('stat-cards').innerHTML=
    '<div class="stat-card"><div class="val">'+s.totalEvents+'</div><div class="label">Total Events</div></div>'+
    '<div class="stat-card"><div class="val">'+s.uniqueIPs+'</div><div class="label">Unique IPs</div></div>'+
    '<div class="stat-card"><div class="val">'+(s.last24h?.events||0)+'</div><div class="label">Last 24h</div></div>';
  const ct=document.querySelector('#cat-table tbody');
  ct.innerHTML=Object.entries(s.byCategory||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+badge(k)+'</td><td>'+v+'</td></tr>').join('');
  const pt=document.querySelector('#port-table tbody');
  pt.innerHTML=Object.entries(s.byPort||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('');
  const cot=document.querySelector('#country-table tbody');
  cot.innerHTML=Object.entries(s.byCountry||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('');
  const uat=document.querySelector('#ua-table tbody');
  uat.innerHTML=(s.topUserAgents||[]).map(u=>'<tr><td>'+esc(u.ua)+'</td><td>'+u.count+'</td></tr>').join('');
}

let mapInit=false;
function initMap(){
  if(mapInit)return;mapInit=true;
  const mv=document.getElementById('mapview');
  mv.style.height='60vh';
  const map=L.map(mv).setView([30,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM',maxZoom:18}).addTo(map);
  fetch('/admin/api/geo/markers?date='+new Date().toISOString().slice(0,10)).then(r=>r.json()).then(markers=>{
    markers.forEach(m=>{
      L.circleMarker([m.lat,m.lon],{radius:Math.min(4+m.count,20),color:'#f85149',fillColor:'#f85149',fillOpacity:0.6})
        .bindPopup('<b>'+esc(m.ip)+'</b><br>'+esc(m.country+' '+( m.city||''))+'<br>ASN: '+esc(m.asnOrg||'-')+'<br>Events: '+m.count+'<br>'+m.categories.map(c=>badge(c)).join(' '))
        .addTo(map);
    });
  });
}

async function loadPI(){
  const r=await fetch('/admin/api/events?category=prompt_injection&limit=100');
  const evts=await r.json();
  document.querySelector('#pi-table tbody').innerHTML=evts.map(e=>
    '<tr><td>'+esc(e.timestamp?.slice(0,19)||'')+'</td><td class="ip">'+esc(e.source_ip||'')+'</td><td>'+esc(JSON.stringify(e.body||'').slice(0,200))+'</td></tr>'
  ).join('');
}

async function loadCanary(){
  const r=await fetch('/admin/api/stats');
  const s=await r.json();
  document.querySelector('#canary-table tbody').innerHTML=(s.canaryAlerts||[]).map(a=>
    '<tr><td>'+esc((a.key||'').slice(0,30)+'...')+'</td><td>'+esc(a.usedAt||'')+'</td><td class="ip">'+esc(a.fromIP||'')+'</td></tr>'
  ).join('')||'<tr><td colspan="3" style="color:#8b949e">No canary alerts yet</td></tr>';
}

async function loadTop(){
  const r=await fetch('/admin/api/stats');
  const s=await r.json();
  document.querySelector('#top-table tbody').innerHTML=(s.topIPs||[]).map(t=>
    '<tr><td class="ip">'+esc(t.ip)+'</td><td>'+t.count+'</td><td>'+t.categories.map(c=>badge(c)).join(' ')+'</td><td>'+esc(t.geo?.country||'-')+'</td><td>'+esc(t.geo?.asnOrg||'-')+'</td></tr>'
  ).join('')||'<tr><td colspan="5" style="color:#8b949e">No data yet</td></tr>';
}
<\/script>
</body>
</html>`
}
