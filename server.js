const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 1800 });
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// === MANIFESTE ===
const manifest = {
    id: 'org.stremio.go-addon',
    version: '3.0.0',
    name: 'Go Addon',
    description: 'Torrents depuis MagnetDL',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

app.get('/manifest.json', (req, res) => {
    res.json(manifest);
});

// === FONCTIONS ===
function extraireQualite(titre) {
    const qualite = { resolution: '1080p', codec: 'x264', hdr: 'SDR' };
    if (!titre) return qualite;
    
    if (titre.match(/2160p|4k|uhd/i)) qualite.resolution = '2160p';
    else if (titre.match(/1080p|fhd/i)) qualite.resolution = '1080p';
    else if (titre.match(/720p|hd/i)) qualite.resolution = '720p';
    
    if (titre.match(/hevc|HEVC|x265|h265/i)) qualite.codec = 'HEVC';
    else if (titre.match(/x264|h264|avc/i)) qualite.codec = 'x264';
    
    if (titre.match(/dolby.?vision|dv/i)) qualite.hdr = 'DV';
    else if (titre.match(/hdr10\+/i)) qualite.hdr = 'HDR10+';
    else if (titre.match(/hdr/i)) qualite.hdr = 'HDR';
    
    return qualite;
}

function calculerScore(torrent) {
    let score = 0;
    
    // Résolution
    if (torrent.resolution === '2160p') score += 40;
    else if (torrent.resolution === '1080p') score += 30;
    else if (torrent.resolution === '720p') score += 20;
    else score += 10;
    
    // Seeders
    const s = torrent.seeders || 0;
    if (s >= 100) score += 30;
    else if (s >= 50) score += 25;
    else if (s >= 20) score += 20;
    else if (s >= 10) score += 15;
    else if (s >= 5) score += 10;
    else score += 2;
    
    // Codec
    if (torrent.codec?.match(/hevc|HEVC|x265|h265/i)) score += 15;
    else if (torrent.codec?.match(/x264|h264|avc/i)) score += 10;
    
    // HDR
    if (torrent.hdr?.includes('DV')) score += 15;
    else if (torrent.hdr?.includes('HDR')) score += 12;
    
    return Math.min(100, score);
}

// === RECHERCHE SUR MAGNETDL ===
async function searchMagnetDL(query) {
    try {
        console.log(`Recherche MagnetDL: ${query}`);
        
        const response = await axios.get('https://www.magnetdl.com/search/', {
            params: { q: query },
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const html = response.data;
        
        // Parser les résultats (recherche basique)
        const torrents = [];
        const rows = html.split('<tr>');
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Extraire le titre
            const titleMatch = row.match(/<a href="[^"]*" title="([^"]*)"/);
            if (!titleMatch) continue;
            const titre = titleMatch[1].trim();
            
            // Extraire le lien magnet
            const magnetMatch = row.match(/href="(magnet:\?xt=urn:btih:[^"]*)"/);
            if (!magnetMatch) continue;
            const magnet = magnetMatch[1];
            
            // Extraire infoHash
            const infoHashMatch = magnet.match(/btih:([a-fA-F0-9]{40})/);
            if (!infoHashMatch) continue;
            const infoHash = infoHashMatch[1].toLowerCase();
            
            // Extraire seeders
            const seedersMatch = row.match(/<td class="s">(\d+)</);
            const seeders = seedersMatch ? parseInt(seedersMatch[1]) : 0;
            
            // Extraire taille
            const sizeMatch = row.match(/<td class="sz">([^<]+)</);
            const taille = sizeMatch ? sizeMatch[1].trim() : '';
            
            const qualite = extraireQualite(titre);
            
            torrents.push({
                infoHash: infoHash,
                title: titre,
                seeders: seeders,
                resolution: qualite.resolution,
                codec: qualite.codec,
                hdr: qualite.hdr,
                magnet: magnet,
                provider: 'MagnetDL',
                taille: taille
            });
        }
        
        console.log(`MagnetDL: ${torrents.length} résultats`);
        return torrents;
        
    } catch (error) {
        console.error('MagnetDL erreur:', error.message);
        return [];
    }
}

// === RECHERCHE VIA SOLIDTORRENTS ===
async function searchSolidTorrents(query) {
    try {
        console.log(`Recherche SolidTorrents: ${query}`);
        
        const response = await axios.get('https://solidtorrents.net/api/v1/search', {
            params: {
                q: query,
                sort: 'seeders',
                order: 'desc',
                limit: 10
            },
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });
        
        if (!response.data?.results) return [];
        
        return response.data.results.map(r => {
            const qualite = extraireQualite(r.title);
            return {
                infoHash: r.info_hash,
                title: r.title,
                seeders: r.seeders || 0,
                resolution: qualite.resolution,
                codec: qualite.codec,
                hdr: qualite.hdr,
                magnet: `magnet:?xt=urn:btih:${r.info_hash}&dn=${encodeURIComponent(r.title)}`,
                provider: 'SolidTorrents',
                taille: r.size || ''
            };
        });
        
    } catch (error) {
        console.error('SolidTorrents erreur:', error.message);
        return [];
    }
}

// === RECUPERER LE TITRE VIA TMDB ===
async function getTitreTMDB(imdbId, type) {
    try {
        // Utiliser l'API OMDb (gratuite, pas besoin de clé pour les recherches de base)
        const response = await axios.get(`https://www.omdbapi.com/`, {
            params: {
                i: imdbId,
                plot: 'short',
                r: 'json'
            },
            timeout: 10000
        });
        
        if (response.data?.Title) {
            return {
                titre: response.data.Title,
                annee: response.data.Year,
                type: type
            };
        }
        
        // Fallback: utiliser l'ID IMDB comme query
        return { titre: imdbId, annee: '', type: type };
        
    } catch (error) {
        console.error('OMDb erreur:', error.message);
        return { titre: imdbId, annee: '', type: type };
    }
}

// === ROUTE PRINCIPALE ===
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}_${id}`;
    
    console.log(`\n🔍 Recherche: ${type} ${id}`);
    
    // Vérifier le cache
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log('✓ Cache hit');
        return res.json({ streams: cached });
    }
    
    try {
        // Obtenir le titre du film/série
        const info = await getTitreTMDB(id, type);
        const query = type === 'movie' ? info.titre : `${info.titre} s01e01`;
        
        console.log(`Recherche pour: "${query}"`);
        
        // Rechercher sur les sources
        const [magnetdlResults, solidResults] = await Promise.all([
            searchMagnetDL(query),
            searchSolidTorrents(query)
        ]);
        
        let allTorrents = [...magnetdlResults, ...solidResults];
        
        // Dédupliquer
        const seen = new Map();
        allTorrents.forEach(t => {
            if (!seen.has(t.infoHash) || t.seeders > seen.get(t.infoHash).seeders) {
                seen.set(t.infoHash, t);
            }
        });
        const uniqueTorrents = Array.from(seen.values());
        
        if (uniqueTorrents.length === 0) {
            console.log('⚠️ Aucun résultat');
            return res.json({ streams: [] });
        }
        
        // Calculer scores et trier
        uniqueTorrents.forEach(t => t.score = calculerScore(t));
        uniqueTorrents.sort((a, b) => b.score - a.score);
        
        const topTorrents = uniqueTorrents.slice(0, 15);
        
        // Formater pour Stremio
        const streams = topTorrents.map((t, i) => {
            let emoji = '';
            if (i === 0) emoji = '🥇 ';
            else if (i === 1) emoji = '🥈 ';
            else if (i === 2) emoji = '🥉 ';
            
            return {
                name: 'Go Addon',
                title: `${emoji}${t.resolution} | ${t.codec} | ${t.hdr}\n💚 ${t.seeders} seeds | ⭐${t.score}/100 | 📡 ${t.provider}\n📦 ${t.taille || 'N/A'}`,
                infoHash: t.infoHash,
                url: t.magnet,
                behaviorHints: { notWebReady: true }
            };
        });
        
        console.log(`✅ ${streams.length} streams envoyés\n`);
        
        // Mettre en cache
        cache.set(cacheKey, streams);
        
        res.json({ streams });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.json({ streams: [] });
    }
});

// === PAGE DE TEST ===
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Go Addon</title>
            <style>
                body { font-family: Arial; margin: 40px; background: #1a1a2e; color: #fff; }
                a { color: #4ecdc4; display: block; margin: 10px 0; padding: 10px; background: #16213e; border-radius: 5px; text-decoration: none; }
                a:hover { background: #0f3460; }
                .section { margin: 30px 0; }
            </style>
        </head>
        <body>
            <h1>🎬 Go Addon - Test</h1>
            <div class="section">
                <h3>🔍 Test direct MagnetDL:</h3>
                <a href="/stream/movie/tt0111161.json">The Shawshank Redemption</a>
                <a href="/stream/movie/tt0468569.json">The Dark Knight</a>
                <a href="/stream/series/tt0944947.json">Game of Thrones</a>
            </div>
            <p><a href="/manifest.json">📋 Manifeste</a></p>
        </body>
        </html>
    `);
});

// Route santé Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Go Addon v3.0 sur le port ${PORT}`);
    console.log(`📝 Page de test: http://localhost:${PORT}/test\n`);
});
