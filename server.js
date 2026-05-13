const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

// Cache de 30 minutes
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

// ⏱️ Timeout 7 secondes
const TIMEOUT = 7000;

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.3.5', // Version incrémentée pour forcer la mise à jour Stremio
    name: 'Link-Dz⚡',
    description: 'Agregateur Multi-Sources Rapide - Films & Series By Superadlen DZ',
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
    
    if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) quality = '🎬 4K';
    else if (t.includes('1440p') || t.includes('2k')) quality = '📺 2K';
    else if (t.includes('1080p') || t.includes('fhd')) quality = '📺 1080p';
    else if (t.includes('720p') || t.includes('hd')) quality = '🖥️ 720p';
    else if (t.includes('480p') || t.includes('sd')) quality = '📱 480p';
    else if (t.includes('cam')) quality = '📱 CAM';
    else quality = '🎥 HD';
    
    if (t.includes('bluray') || t.includes('bdrip')) extra.push('BluRay');
    if (t.includes('remux')) extra.push('REMUX');
    if (t.includes('web-dl') || t.includes('webdl')) extra.push('WEB-DL');
    if (t.includes('hevc') || t.includes('x265')) extra.push('📽️HEVC');
    if (t.includes('atmos')) extra.push('🎧Atmos');
    
    return { quality, extra: extra.join(' • ') };
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function getQualityScore(title) {
    const t = (title || '').toLowerCase();
    let score = 0;
    if (t.includes('4k') || t.includes('2160p')) score = 8;
    else if (t.includes('1080p')) score = 6;
    else if (t.includes('720p')) score = 4;
    else score = 3;
    if (t.includes('bluray')) score += 2;
    return score;
}

// Route Manifest avec Header Correct
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(MANIFEST);
});

app.get('/', (req, res) => {
    res.send(`
        <body style="background:#0f0f1a; color:white; font-family:sans-serif; text-align:center; padding:50px;">
            <div style="background:#1a1a2e; padding:30px; border-radius:15px; max-width:500px; margin:0 auto; border:1px solid #303056;">
                <h1 style="color:#e94560;">⚡ Link-Dz Addon</h1>
                <p>Agrégateur Multi-Sources pour Stremio</p>
                <a href="stremio://${req.get('host')}/manifest.json" style="background:#e94560; color:white; padding:15px 30px; border-radius:5px; text-decoration:none; font-weight:bold; display:inline-block; margin:20px 0;">🚀 Installer sur Stremio</a>
                <p style="color:#666;">By Superadlen DZ 🇩🇿</p>
            </div>
        </body>
    `);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    console.log(`🔍 Recherche: ${type} ${id}`);
    
    const promises = SOURCES.map(source => 
        axios.get(`${source.url}/stream/${type}/${id}.json`, {
            timeout: TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        .then(response => {
            if (response.data?.streams) {
                return response.data.streams.map(stream => {
                    const qInfo = getQualityInfo(stream.title || '');
                    const seeds = getSeeders(stream.title || '');
                    
                    // Extraction et nettoyage de l'infoHash
                    let infoHash = stream.infoHash || '';
                    if (!infoHash && stream.url && stream.url.startsWith('magnet:')) {
                        const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                        if (match) infoHash = match[1];
                    }
                    
                    if (!infoHash && !stream.url) return null;

                    return {
                        name: `${source.name}\n${qInfo.quality}`,
                        title: `${stream.title || source.name}\n👤 Seeds: ${seeds} | ${qInfo.extra}`,
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: {
                            notWebReady: true,
                            bingeGroup: `link-dz-${source.name}`
                        }
                    };
                }).filter(s => s !== null);
            }
            return [];
        })
        .catch(() => [])
    );
    
    const results = await Promise.all(promises);
    let allStreams = results.flat();
    
    // Déduplication
    const seen = new Set();
    allStreams = allStreams.filter(s => {
        const key = s.infoHash || s.url;
        if (key && !seen.has(key)) {
            seen.add(key);
            return true;
        }
        return false;
    });
    
    // Tri
    allStreams.sort((a, b) => {
        const qA = getQualityScore(a.name + a.title);
        const qB = getQualityScore(b.name + b.title);
        if (qB !== qA) return qB - qA;
        return getSeeders(b.title) - getSeeders(a.title);
    });
    
    const result = { streams: allStreams.slice(0, 40) };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Link-Dz prêt sur le port ${PORT}`));
