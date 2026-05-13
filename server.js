const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.0.0',
    name: 'Go-Link',
    description: 'Agregateur Multi-Sources - Films & Series',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: [],
    logo: 'https://i.pinimg.com/736x/68/61/90/686190506f87cfc470530dea4bf76a65.jpg'
};

// Sources qui fonctionnent
const SOURCES = [
    'https://filmora-production.up.railway.app',
    'https://str.zmb.lat/lite'
];

function getQualityScore(title) {
    const t = (title || '').toLowerCase();
    let score = 0;
    
    if (t.includes('4k') || t.includes('2160p')) score = 8;
    else if (t.includes('1080p')) score = 6;
    else if (t.includes('720p')) score = 4;
    else if (t.includes('480p')) score = 2;
    else score = 3;
    
    if (t.includes('bluray') || t.includes('remux')) score += 2;
    
    return score;
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
        <body style="background:#1a1a2e;color:white;font-family:Arial;text-align:center;padding:50px;">
            <h1>🚀 Go-Link Addon</h1>
            <p>Addon operationnel !</p>
            <a href="stremio://${req.get('host')}/manifest.json" 
               style="background:#e94560;color:white;padding:15px 30px;border-radius:5px;text-decoration:none;font-weight:bold;">
               Installer dans Stremio
            </a>
            <p style="margin-top:20px;color:#888;">URL: ${url}</p>
        </body>
        </html>
    `);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    console.log(`Recherche: ${type} ${id}`);
    
    let allStreams = [];
    
    for (const source of SOURCES) {
        try {
            const response = await axios.get(`${source}/stream/${type}/${id}.json`, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (response.data?.streams) {
                console.log(`${source}: ${response.data.streams.length} streams`);
                allStreams = [...allStreams, ...response.data.streams];
            }
        } catch (error) {
            console.log(`${source}: ❌`);
        }
    }
    
    // Trier par qualite puis seeders
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
app.listen(PORT, () => console.log(`Go-Link sur le port ${PORT}`));
