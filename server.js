const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

// Cache de 30 minutes
const streamCache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.0.0',
    name: 'Go-Link⚡📺',
    description: '💙Agrégateur Multi-Sources (Tri par Qualité puis Seeds) By Superadlen DZ.💚',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: [],
    logo: 'https://i.pinimg.com/736x/68/61/90/686190506f87cfc470530dea4bf76a65.jpg',
    behaviorHints: { configurable: true, configurationRequired: false }
};

// Liste des sources
const SOURCES = [
    { url: 'https://filmora-production.up.railway.app', name: 'Filmora' },
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'PeerFlix' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Zamunda' },
    { url: 'https://str.zmb.lat/lite', name: 'ZMB Lite' },
    { url: 'https://torrentio.strem.fun', name: 'TorrentIO' },
    { url: 'https://mediafusion.elfhosted.com', name: 'MediaFusion' },
    { url: 'https://stremio-jackett.elfhosted.com', name: 'Jackett' }
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// --- SCORING AMÉLIORÉ ---
function getQualityScore(title) {
    const t = (title || '').toLowerCase();
    let score = 0;
    let details = [];

    // Résolution (40 points)
    if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) {
        score += 40;
        details.push('4K');
    } else if (t.includes('1440p') || t.includes('2k')) {
        score += 35;
        details.push('2K');
    } else if (t.includes('1080p') || t.includes('fhd')) {
        score += 30;
        details.push('1080p');
    } else if (t.includes('720p') || t.includes('hd')) {
        score += 20;
        details.push('720p');
    } else if (t.includes('480p') || t.includes('sd')) {
        score += 10;
        details.push('SD');
    } else {
        score += 15;
        details.push('HD');
    }

    // Source/Type (20 points)
    if (t.includes('bluray') || t.includes('bdrip') || t.includes('bdrip')) {
        score += 20;
        details.push('BluRay');
    } else if (t.includes('remux')) {
        score += 20;
        details.push('REMUX');
    } else if (t.includes('web-dl') || t.includes('webdl')) {
        score += 15;
        details.push('WEB-DL');
    } else if (t.includes('webrip') || t.includes('webrip')) {
        score += 12;
        details.push('WEBRip');
    } else if (t.includes('hdtv')) {
        score += 10;
        details.push('HDTV');
    } else if (t.includes('dvdrip') || t.includes('dvd')) {
        score += 5;
        details.push('DVDRip');
    }

    // Codec (15 points)
    if (t.match(/hevc|HEVC|x265|h265/)) {
        score += 15;
        details.push('HEVC');
    } else if (t.match(/av1/)) {
        score += 15;
        details.push('AV1');
    } else if (t.match(/x264|h264|avc/)) {
        score += 10;
        details.push('x264');
    } else if (t.match(/xvid|divx/)) {
        score += 3;
        details.push('XviD');
    }

    // HDR (15 points)
    if (t.match(/dolby.?vision|dv/)) {
        score += 15;
        details.push('DV');
    } else if (t.includes('hdr10+')) {
        score += 14;
        details.push('HDR10+');
    } else if (t.includes('hdr10')) {
        score += 12;
        details.push('HDR10');
    } else if (t.includes('hdr')) {
        score += 10;
        details.push('HDR');
    }

    // Audio (10 points)
    if (t.match(/atmos|truehd/)) {
        score += 10;
        details.push('Atmos');
    } else if (t.match(/dts[- ]?[xh]|dts:?[xh]/)) {
        score += 10;
        details.push('DTS:X');
    } else if (t.match(/dts[- ]?hd|dts:?hd/)) {
        score += 8;
        details.push('DTS-HD');
    } else if (t.match(/dts/)) {
        score += 7;
        details.push('DTS');
    } else if (t.match(/ddp|e[- ]?ac[- ]?3|eac3/)) {
        score += 6;
        details.push('DD+');
    } else if (t.match(/ac3|dd5\.1/)) {
        score += 5;
        details.push('DD5.1');
    } else if (t.match(/aac/)) {
        score += 4;
        details.push('AAC');
    }

    return {
        score: Math.min(100, score),
        label: details.join(' • ') || 'HD',
        details: details
    };
}

function extractSeeders(title) {
    if (!title) return 0;
    const patterns = [
        /👤\s*(\d+)/,
        /Seeds?:?\s*(\d+)/i,
        /S:\s*(\d+)/i,
        /💚\s*(\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) return parseInt(match[1]);
    }
    return 0;
}

// --- ROUTES ---
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        sources: SOURCES.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/manifest.json', (req, res) => res.json(MANIFEST));

app.get('/', (req, res) => {
    const manifestUrl = `${req.protocol}://${req.get('host')}/manifest.json`;
    const stremioUrl = `stremio://${req.get('host')}/manifest.json`;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Go-Link ⚡📺</title>
            <meta charset="utf-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
                    color: white;
                    font-family: 'Segoe UI', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .card {
                    background: rgba(26, 26, 46, 0.95);
                    border: 1px solid #303056;
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    text-align: center;
                    max-width: 500px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                }
                .logo {
                    width: 120px;
                    height: 120px;
                    border-radius: 20px;
                    object-fit: cover;
                    border: 3px solid #e94560;
                    margin-bottom: 1.5rem;
                }
                h1 {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(45deg, #e94560, #0f3460);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .badge {
                    display: inline-block;
                    background: #e94560;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    margin: 10px 0;
                }
                .sources {
                    margin: 1.5rem 0;
                    font-size: 0.9rem;
                    color: #aaa;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(45deg, #e94560, #c23152);
                    color: white;
                    padding: 15px 40px;
                    text-decoration: none;
                    border-radius: 50px;
                    font-weight: bold;
                    font-size: 1.1rem;
                    margin: 1rem 0;
                    transition: transform 0.3s, box-shadow 0.3s;
                    box-shadow: 0 5px 20px rgba(233, 69, 96, 0.4);
                }
                .btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 30px rgba(233, 69, 96, 0.6);
                }
                .author {
                    margin-top: 2rem;
                    font-size: 0.8rem;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <img src="${MANIFEST.logo}" alt="Go-Link Logo" class="logo">
                <h1>Go-Link ⚡📺</h1>
                <div class="badge">v${MANIFEST.version}</div>
                <p style="margin: 1rem 0; font-size: 1.1rem;">
                    ${MANIFEST.description}
                </p>
                <div class="sources">
                    📡 ${SOURCES.length} sources agrégées<br>
                    🎯 Tri: Qualité > Seeders<br>
                    🎬 Films • 📺 Séries
                </div>
                <a href="${stremioUrl}" class="btn">🚀 Installer dans Stremio</a>
                <br>
                <small style="color: #888;">ou copiez l'URL du manifeste</small>
                <div class="author">
                    By Superadlen DZ 🇩🇿
                </div>
            </div>
        </body>
        </html>
    `);
});

// Route principale des streams
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;

    const cachedData = streamCache.get(cacheKey);
    if (cachedData) {
        console.log(`✅ Cache: ${type} ${id}`);
        return res.json(cachedData);
    }

    console.log(`\n🔍 Recherche: ${type} ${id}`);
    console.log(`📡 Sources: ${SOURCES.length}`);

    // Lancer toutes les requêtes en parallèle
    const requests = SOURCES.map(source => 
        axios.get(`${source.url}/stream/${type}/${id}.json`, { 
            timeout: 8000, 
            headers: { 'User-Agent': USER_AGENT },
            validateStatus: () => true // Accepter tous les statuts
        }).then(response => ({
            source: source.name,
            data: response.data,
            status: response.status
        })).catch(error => ({
            source: source.name,
            error: error.message,
            status: 0
        }))
    );

    const responses = await Promise.all(requests);
    let allStreams = [];

    // Traiter les réponses
    responses.forEach(response => {
        if (response.status === 200 && response.data?.streams) {
            const count = response.data.streams.length;
            console.log(`  ✅ ${response.source}: ${count} streams`);
            
            const modified = response.data.streams.slice(0, 30).map(s => {
                const quality = getQualityScore(s.title || '');
                const seeders = extractSeeders(s.title || '');
                
                return {
                    name: `Go-Link⚡`,
                    title: s.title || `${response.source} Stream`,
                    infoHash: s.infoHash,
                    url: s.url || s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : undefined,
                    description: s.description || `${quality.label} | 💚${seeders} seeds | 📡${response.source}`,
                    behaviorHints: s.behaviorHints || { notWebReady: true },
                    // Métadonnées pour le tri
                    _qualityScore: quality.score,
                    _seeders: seeders,
                    _source: response.source,
                    _qualityLabel: quality.label
                };
            });
            allStreams = [...allStreams, ...modified];
        } else {
            console.log(`  ❌ ${response.source}: ${response.status === 0 ? 'Timeout/Erreur' : 'Status ' + response.status}`);
        }
    });

    // Déduplication
    const uniqueMap = new Map();
    allStreams.forEach(s => {
        const key = s.infoHash || s.url || s.title;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, s);
        } else {
            // Garder celui avec le plus de seeders
            const existing = uniqueMap.get(key);
            if (s._seeders > existing._seeders) {
                uniqueMap.set(key, s);
            }
        }
    });

    // Trier et limiter
    const finalStreams = Array.from(uniqueMap.values())
        .sort((a, b) => {
            // 1. Score de qualité
            if (b._qualityScore !== a._qualityScore) {
                return b._qualityScore - a._qualityScore;
            }
            // 2. Nombre de seeders
            return b._seeders - a._seeders;
        })
        .slice(0, 60)
        .map(({ _qualityScore, _seeders, _source, _qualityLabel, ...rest }) => rest);

    console.log(`📊 Total unique: ${finalStreams.length} streams`);
    console.log(`🏆 Top quality: ${finalStreams[0]?._qualityLabel || 'N/A'}`);

    const result = { streams: finalStreams };
    streamCache.set(cacheKey, result);
    res.json(result);
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║     🚀 Go-Link Addon v${MANIFEST.version}      ║
    ║     📡 ${SOURCES.length} sources configurées          ║
    ║     🌐 Port: ${PORT}                      ║
    ║     📋 /manifest.json               ║
    ║     🏠 / (page d'accueil)           ║
    ╚══════════════════════════════════════╝
    `);
});
