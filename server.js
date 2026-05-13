const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });
const TIMEOUT = 7000;

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.4.1', 
    name: 'Link-Dz⚡',
    description: 'Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'],
    catalogs: [],
    logo: 'https://i.pinimg.com/1200x/45/26/88/45268878ba1c1123ee8621b2d0081fab.jpg'
};

const SOURCES = [
    { url: 'https://filmora-production.up.railway.app', name: 'Link-Dz Max' },
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Link-Dz Plus' },
    { url: 'https://str.zmb.lat/lite', name: 'Link-Dz Pro' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Link-Dz Ultra' }
];

function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🗣️🌐';

    // Détection de la langue
   if (t.includes('multi') || (t.includes('fr') && t.includes('en'))) lang = '🗣️🇫🇷/🇺🇸 MULTI';
else if (t.includes('french') || t.includes(' vff ') || t.includes(' vf ')) lang = '🔉🇫🇷 VF';
else if (t.includes('vostfr')) lang = '🇫🇷 VOSTFR';
else if (t.includes('english') || t.includes(' en ') || t.includes(' eng ')) lang = '🔉🇺🇸 EN';
else if (t.includes('arabic') || t.includes(' ar ') || t.includes(' ara ')) lang = '🔉🇩🇿 AR';
else if (t.includes('spanish') || t.includes(' es ') || t.includes(' spa ')) lang = '🔉🇪🇸 ES';
else if (t.includes('german') || t.includes(' de ') || t.includes(' ger ')) lang = '🔉🇩🇪 DE';
else if (t.includes('italian') || t.includes(' it ') || t.includes(' ita ')) lang = '🔉🇮🇹 IT';
else if (t.includes('portuguese') || t.includes(' pt ') || t.includes(' por ')) lang = '🔉🇵🇹 PT';
else if (t.includes('russian') || t.includes(' ru ') || t.includes(' rus ')) lang = '🔉🇷🇺 RU';
else if (t.includes('turkish') || t.includes(' tr ') || t.includes(' tur ')) lang = '🔉🇹🇷 TR';
else if (t.includes('hindi') || t.includes(' hi ') || t.includes(' hin ')) lang = '🔉🇮🇳 HI';
else if (t.includes('japanese') || t.includes(' jp ') || t.includes(' jpn ')) lang = '🔉🇯🇵 JP';
else if (t.includes('korean') || t.includes(' kr ') || t.includes(' kor ')) lang = '🔉🇰🇷 KR';
else if (t.includes('chinese') || t.includes(' cn ') || t.includes(' chi ')) lang = '🔉🇨🇳 CN';
    
    // Qualité
    if (t.includes('2160p') || t.includes('4k')) quality = '🎬: 4K';
    else if (t.includes('1080p')) quality = '📺: 1080p';
    else if (t.includes('720p')) quality = '🖥️: 720p';
    else if (t.includes('cam')) quality = '📱: CAM';
    else quality = '🎥: HD';
    
    // Formats
    if (t.includes('bluray') || t.includes('bdrip')) extra.push('💿BluRay');
if (t.includes('remux')) extra.push('📀 REMUX');
if (t.includes('web-dl') || t.includes('webdl')) extra.push('🌐WEB-DL');
if (t.includes('webrip')) extra.push('🌍WEBRip');
if (t.includes('dvdrip')) extra.push('📼DVDRip');
if (t.includes('hdrip')) extra.push('🎞️HDRip');
if (t.includes('uhd')) extra.push('🖥️UHD');
if (t.includes('4k')) extra.push('4️⃣K');
if (t.includes('2160p')) extra.push('UHD');
if (t.includes('1080p')) extra.push('FHD');
if (t.includes('720p')) extra.push('HD');
if (t.includes('480p')) extra.push('SD');

if (t.includes('hevc') || t.includes('x265')) extra.push('📽️HEVC');
if (t.includes('x264')) extra.push('🎬x264');

if (t.includes('hdr')) extra.push('✨HDR');
if (t.includes('hdr10')) extra.push('✨HDR10');
if (t.includes('dolby vision') || t.includes('dv')) extra.push('🌈Dolby Vision');

if (t.includes('atmos')) extra.push('🎧Atmos');
if (t.includes('dts')) extra.push('🔊DTS');
if (t.includes('aac')) extra.push('🔉AAC');
if (t.includes('truehd')) extra.push('🎵TrueHD');

if (t.includes('sub') || t.includes('subs') || t.includes('subtitle')) extra.push('💬SUB');
if (t.includes('softsub')) extra.push('📝SoftSub');
if (t.includes('hardsub')) extra.push('📌HardSub');

if (t.includes('dub') || t.includes('dubbed')) extra.push('🎙️DUB');
if (t.includes('dual audio')) extra.push('🎚️Dual Audio');

if (t.includes('proper')) extra.push('✅PROPER');
if (t.includes('repack')) extra.push('♻️REPACK');
if (t.includes('extended')) extra.push('🧩EXTENDED');
if (t.includes('uncut')) extra.push('✂️UNCUT');
    
    return { quality, extra: extra.join('|'), lang };
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(MANIFEST);
});

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f0f1a;color:white;text-align:center;padding:50px;font-family:sans-serif;">
        <div style="background:#1a1a2e;padding:30px;border-radius:15px;max-width:500px;margin:0 auto;border:1px solid #303056;">
            <h1 style="color:#e94560;">⚡ Link-Dz Addon</h1>
            <p>V2.3.7 - Langues dans la description</p>
            <a href="stremio://${req.get('host')}/manifest.json" style="background:#e94560;color:white;padding:15px 30px;border-radius:5px;text-decoration:none;font-weight:bold;display:inline-block;margin:20px 0;">🚀 Installer</a>
        </div>
    </body>`);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    const promises = SOURCES.map(source => 
        axios.get(`${source.url}/stream/${type}/${id}.json`, { timeout: TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then(response => {
            if (response.data?.streams) {
                return response.data.streams.map(stream => {
                    const info = getQualityInfo(stream.title || '');
                    const seeds = getSeeders(stream.title || '');
                    
                    let infoHash = stream.infoHash || '';
                    if (!infoHash && stream.url?.startsWith('magnet:')) {
                        const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                        if (match) infoHash = match[1];
                    }
                    
                    if (!infoHash && !stream.url) return null;

                    // Infos regroupées : Langue + Seeds + Formats
                    const technicalDetails = `${info.lang}|👤:${seeds}|${info.extra || 'Standard'}`;
                    const originalFileName = stream.title ? stream.title.split('\n')[0] : source.name;

                    return {
                        // Name reste simple
                        name: `${source.name}\n${info.quality}`,
                        
                        // Title regroupe tout (Langue, Seeds, Formats, Nom original)
                        title: `${technicalDetails}\n${originalFileName}`,
                        
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: { notWebReady: true, bingeGroup: `link-dz` }
                    };
                }).filter(s => s !== null);
            }
            return [];
        })
        .catch(() => [])
    );
    
    const results = await Promise.all(promises);
    let allStreams = results.flat();
    
    const seen = new Set();
    allStreams = allStreams.filter(s => {
        const key = s.infoHash || s.url;
        if (key && !seen.has(key)) { seen.add(key); return true; }
        return false;
    });
    
    // Tri intelligent (Qualité d'abord, puis seeds)
    allStreams.sort((a, b) => {
        const getScore = (name) => {
            if (name.includes('4K')) return 10;
            if (name.includes('1080p')) return 7;
            if (name.includes('720p')) return 5;
            return 1;
        };
        const diff = getScore(b.name) - getScore(a.name);
        if (diff !== 0) return diff;
        return getSeeders(b.title) - getSeeders(a.title);
    });
    
    const result = { streams: allStreams.slice(0, 40) };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Link-Dz v2.3.7 Online`));
