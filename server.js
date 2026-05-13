const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

// ⏱️ Timeout réduit à 7 secondes
const TIMEOUT = 7000;

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.3.4',
    name: 'Link-Dz⚡',
    description: 'Agregateur Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'], // 🔥 AJOUTÉ POUR STREMIO
    catalogs: [],
    logo: 'https://i.pinimg.com/1200x/45/26/88/45268878ba1c1123ee8621b2d0081fab.jpg'
};

const SOURCES = [
    { 
        url: 'https://filmora-production.up.railway.app', 
        name: 'Link-Dz Max' 
    },
    { 
        url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', 
        name: 'Link-Dz Plus' 
    },
    { 
        url: 'https://str.zmb.lat/lite', 
        name: 'Link-Dz Pro' 
    },
    { 
        url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', 
        name: 'Link-Dz Ultra' 
    }
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
    else if (t.includes('cam') || t.includes('cam')) quality = '📱 CAM';
    else if (t.includes('camrip') || t.includes('camrip')) quality = '🖥️ CAM-RIP';
    else quality = '🎥 HD';
    
    if (t.includes('bluray') || t.includes('bdrip')) extra.push('BluRay');
    if (t.includes('remux')) extra.push('REMUX');
    if (t.includes('web-dl') || t.includes('webdl')) extra.push('WEB-DL');
    if (t.includes('webrip')) extra.push('WEBRip');
    if (t.includes('hdtv')) extra.push('HDTV');
    if (t.includes('dolby vision') || t.includes('dv')) extra.push('Dolby-Vision');
    else if (t.includes('hdr10+')) extra.push('HDR10+');
    else if (t.includes('hdr10')) extra.push('HDR10');
    else if (t.includes('hdr')) extra.push('HDR');
    if (t.includes('hevc') || t.includes('x265')) extra.push('📽️HEVC');
    else if (t.includes('av1')) extra.push('📹AV1');
    if (t.includes('atmos')) extra.push('🎧Atmos');
    else if (t.includes('dts')) extra.push('🔉DTS');
    
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
    if (t.includes('bluray') || t.includes('remux')) score += 2;
    if (t.includes('hevc') || t.includes('x265')) score += 1;
    if (t.includes('dolby') || t.includes('atmos')) score += 1;
    return score;
}

app.get('/manifest.json', (req, res) => res.json(MANIFEST));

app.get('/', (req, res) => {
    const url = `${req.protocol}://${req.get('host')}/manifest.json`;
    res.send(`
        <html>
        <head>
            <style>
                body { background:#0f0f1a; color:white; font-family:Arial; text-align:center; padding:50px; }
                .card { background:#1a1a2e; padding:30px; border-radius:15px; max-width:500px; margin:0 auto; border:1px solid #303056; }
                h1 { color:#e94560; }
                .btn { background:#e94560; color:white; padding:15px 30px; border-radius:5px; text-decoration:none; font-weight:bold; display:inline-block; margin:20px 0; }
                .sources { text-align:left; margin:20px 0; padding:15px; background:#16213e; border-radius:10px; }
                .source { padding:5px 0; border-bottom:1px solid #303056; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>⚡ Link-Dz Addon</h1>
                <p>Agrégateur Multi-Sources Rapide</p>
                <div class="sources">
                    <strong>📡 Sources (timeout: 7s) :</strong>
                    ${SOURCES.map(s => `<div class="source">• ${s.name}</div>`).join('')}
                </div>
                <a href="stremio://${req.get('host')}/manifest.json" class="btn">🚀 Installer</a>
                <p style="color:#888;font-size:12px;">${url}</p>
                <p style="color:#666;">By Superadlen DZ 🇩🇿</p>
            </div>
        </body>
        </html>
    `);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    console.log(`\n🔍 Recherche: ${type} ${id} (timeout: ${TIMEOUT/1000}s)`);
    
    let allStreams = [];
    
    // Lancer toutes les requêtes en parallèle
    const promises = SOURCES.map(source => 
        axios.get(`${source.url}/stream/${type}/${id}.json`, {
            timeout: TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        .then(response => {
            if (response.data?.streams) {
                const modified = response.data.streams
                    .map(stream => {
                        const qualityInfo = getQualityInfo(stream.title || '');
                        const seeders = getSeeders(stream.title || '');
                        
                        // 🔥 ADAPTATION POUR STREMIO : on veut un infoHash ou un magnet valide
                        let infoHash = stream.infoHash || '';
                        let url = stream.url || '';

                        // Si le flux n'a ni infoHash ni magnet, on regarde s'il a un lien externe (magnet)
                        if (!infoHash && !url && stream.externalUrl) {
                            if (stream.externalUrl.startsWith('magnet:')) {
                                url = stream.externalUrl;
                                const match = url.match(/btih:([a-fA-F0-9]{40})/);
                                if (match) infoHash = match[1].toLowerCase();
                            }
                        }

                        // Si on n'a toujours rien, ce flux est inutilisable dans Stremio -> on l'ignore
                        if (!infoHash && !url) {
                            return null;
                        }

                        // Construit le stream formaté pour Stremio
                        return {
                            name: `${source.name}\n${qualityInfo.quality}`,
                            title: stream.title || `${source.name}`,
                            description: qualityInfo.extra 
                                ? `${qualityInfo.extra} | 💚 ${seeders} seeds`
                                : `💚 ${seeders} seeds`,
                            // Champs obligatoires pour un stream torrent dans Stremio
                            infoHash: infoHash,
                            url: url || (infoHash ? `magnet:?xt=urn:btih:${infoHash}` : ''),
                            // Indispensable pour que Stremio le traite comme un torrent
                            behaviorHints: {
                                notWebReady: true,
                                bingeGroup: `${source.name}`
                            }
                        };
                    })
                    .filter(stream => stream !== null); // retire les flux invalides
                
                console.log(`✅ ${source.name}: ${modified.length} streams utilisables`);
                return modified;
            }
            return [];
        })
        .catch(error => {
            console.log(`❌ ${source.name}: Timeout ou erreur`);
            return [];
        })
    );
    
    const results = await Promise.all(promises);
    allStreams = results.flat();
    
    // Déduplication par infoHash (évite les doublons)
    const seen = new Set();
    allStreams = allStreams.filter(s => {
        const key = s.infoHash || s.url;
        if (key && !seen.has(key)) {
            seen.add(key);
            return true;
        }
        return false;
    });
    
    // Trier par qualité puis seeders
    allStreams.sort((a, b) => {
        const qA = getQualityScore(a.title);
        const qB = getQualityScore(b.title);
        if (qB !== qA) return qB - qA;
        return getSeeders(b.title) - getSeeders(a.title);
    });
    
    const result = { streams: allStreams.slice(0, 50) };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`⚡ Link-Dz Addon démarré (timeout: ${TIMEOUT/1000}s)`);
    SOURCES.forEach(s => console.log(`   • ${s.name}`));
});
