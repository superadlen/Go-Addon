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
    version: '2.3.6', 
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
    let lang = '🌐'; // Symbole par défaut

    // Détection de la langue
    if (t.includes('multi') || (t.includes('fr') && t.includes('en'))) lang = '🇫🇷/🇺🇸';
    else if (t.includes('french') || t.includes(' vff ') || t.includes(' vf ')) lang = '🇫🇷 FR';
    else if (t.includes('vostfr')) lang = '🇫🇷 VOST';
    else if (t.includes('english') || t.includes(' en ') || t.includes(' eng ')) lang = '🇺🇸 EN';
    else if (t.includes('ita')) lang = '🇮🇹 ITA';
    else if (t.includes('spa')) lang = '🇪🇸 SPA';
    
    // Qualité
    if (t.includes('2160p') || t.includes('4k')) quality = '🎬 4K';
    else if (t.includes('1080p')) quality = '📺 1080p';
    else if (t.includes('720p')) quality = '🖥️ 720p';
    else if (t.includes('cam')) quality = '📱 CAM';
    else quality = '🎥 HD';
    
    // Formats
    if (t.includes('bluray') || t.includes('bdrip')) extra.push('BluRay');
    if (t.includes('hevc') || t.includes('x265')) extra.push('HEVC');
    if (t.includes('10bit')) extra.push('10bit');
    
    return { quality, extra: extra.join(' • '), lang };
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function getQualityScore(title) {
    const t = (title || '').toLowerCase();
    let score = 0;
    if (t.includes('4k')) score = 10;
    else if (t.includes('1080p')) score = 7;
    else if (t.includes('720p')) score = 5;
    if (t.includes('french') || t.includes('vf')) score += 2;
    return score;
}

app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(MANIFEST);
});

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f0f1a;color:white;text-align:center;padding:50px;font-family:sans-serif;">
        <div style="background:#1a1a2e;padding:30px;border-radius:15px;max-width:500px;margin:0 auto;border:1px solid #303056;">
            <h1 style="color:#e94560;">⚡ Link-Dz Addon</h1>
            <p>Langues & Qualités optimisées</p>
            <a href="stremio://${req.get('host')}/manifest.json" style="background:#e94560;color:white;padding:15px 30px;border-radius:5px;text-decoration:none;font-weight:bold;display:inline-block;margin:20px 0;">🚀 Installer</a>
        </div>
    </body>`);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    console.log(`🔍 Scan: ${type} ${id}`);
    
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

                    return {
                        // On affiche : Nom Source | Langue | Qualité
                        name: `${source.name}\n${info.lang} ${info.quality}`,
                        
                        // Titre nettoyé : on ne met plus le titre brut original
                        // Mais seulement les seeds et le format technique
                        title: `👤 Seeds: ${seeds} | ${info.extra || 'Standard'}`,
                        
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
    
    allStreams.sort((a, b) => {
        const scoreA = getQualityScore(a.name);
        const scoreB = getQualityScore(b.name);
        return scoreB - scoreA;
    });
    
    const result = { streams: allStreams.slice(0, 40) };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Link-Dz v2.3.5 Online`));
