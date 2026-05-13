const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.1.0',
    name: 'Link-Dz 🌟',
    description: 'Agregateur Multi-Sources - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: [],
    logo: 'https://i.pinimg.com/736x/68/61/90/686190506f87cfc470530dea4bf76a65.jpg'
};

// Sources avec leurs noms personnalisés
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

function getQualityScore(title) {
    const t = (title || '').toLowerCase();
    let score = 0;
    let label = '';
    
    if (t.includes('4k') || t.includes('2160p')) { score = 8; label = '4K'; }
    else if (t.includes('1080p')) { score = 6; label = '1080p'; }
    else if (t.includes('720p')) { score = 4; label = '720p'; }
    else if (t.includes('480p')) { score = 2; label = '480p'; }
    else { score = 3; label = 'HD'; }
    
    if (t.includes('bluray') || t.includes('remux')) { score += 2; label += ' BluRay'; }
    if (t.includes('dolby') || t.includes('atmos')) { score += 1; label += ' Atmos'; }
    if (t.includes('hevc') || t.includes('x265')) { score += 1; label += ' HEVC'; }
    
    return { score, label };
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// Routes
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
                .source:last-child { border-bottom:none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🌟 Link-Dz Addon</h1>
                <p>Agrégateur Multi-Sources</p>
                <div class="sources">
                    <strong>📡 Sources disponibles :</strong>
                    ${SOURCES.map(s => `<div class="source">• ${s.name}</div>`).join('')}
                </div>
                <a href="stremio://${req.get('host')}/manifest.json" class="btn">🚀 Installer dans Stremio</a>
                <p style="color:#888;font-size:12px;">URL: ${url}</p>
                <p style="color:#666;font-size:12px;">By Superadlen DZ 🇩🇿</p>
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
    
    console.log(`\n🔍 Recherche: ${type} ${id}`);
    
    let allStreams = [];
    
    for (const source of SOURCES) {
        try {
            const response = await axios.get(`${source.url}/stream/${type}/${id}.json`, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (response.data?.streams) {
                // Remplacer le nom par le nom personnalisé
                const modified = response.data.streams.map(stream => ({
                    ...stream,
                    name: `📡 ${source.name}`  // Nom personnalisé
                }));
                
                console.log(`✅ ${source.name}: ${modified.length} streams`);
                allStreams = [...allStreams, ...modified];
            }
        } catch (error) {
            console.log(`❌ ${source.name}: Indisponible`);
        }
    }
    
    // Trier par qualité puis seeders
    allStreams.sort((a, b) => {
        const qA = getQualityScore(a.title);
        const qB = getQualityScore(b.title);
        if (qB.score !== qA.score) return qB.score - qA.score;
        return getSeeders(b.title) - getSeeders(a.title);
    });
    
    const result = { streams: allStreams.slice(0, 50) };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Link-Dz Addon démarré');
    console.log(`📡 ${SOURCES.length} sources configurées:`);
    SOURCES.forEach(s => console.log(`   • ${s.name}`));
});
