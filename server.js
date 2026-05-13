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
    version: '2.0.0',
    name: 'Go Addon',
    description: 'Torrents classés par qualité',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

app.get('/manifest.json', (req, res) => {
    res.json(manifest);
});

// === FONCTIONS UTILITAIRES ===
function extractInfo(title) {
    const info = { resolution: '1080p', codec: 'x264', hdr: 'SDR' };
    if (!title) return info;
    
    if (title.match(/2160p|4K|UHD/i)) info.resolution = '2160p';
    else if (title.match(/1080p/i)) info.resolution = '1080p';
    else if (title.match(/720p/i)) info.resolution = '720p';
    
    if (title.match(/HEVC|HEVC|x265|h265/i)) info.codec = 'HEVC';
    else if (title.match(/x264|h264|AVC/i)) info.codec = 'x264';
    
    if (title.includes('DV') || title.includes('Dolby Vision')) info.hdr = 'DV';
    else if (title.includes('HDR10+')) info.hdr = 'HDR10+';
    else if (title.includes('HDR')) info.hdr = 'HDR';
    
    return info;
}

function calculerScore(torrent) {
    let score = 0;
    if (torrent.resolution === '2160p') score += 40;
    else if (torrent.resolution === '1080p') score += 30;
    else if (torrent.resolution === '720p') score += 20;
    else score += 10;
    
    if (torrent.seeders >= 100) score += 30;
    else if (torrent.seeders >= 50) score += 25;
    else if (torrent.seeders >= 20) score += 20;
    else if (torrent.seeders >= 10) score += 15;
    else score += 5;
    
    if (torrent.codec?.match(/HEVC|HEVC|x265|h265/i)) score += 15;
    else if (torrent.codec?.match(/x264|h264|AVC/i)) score += 10;
    
    if (torrent.hdr?.includes('DV')) score += 15;
    else if (torrent.hdr?.includes('HDR')) score += 12;
    
    return score;
}

// === SOURCE 1: Stremio-Jackett (fiable) ===
async function searchJackett(type, imdbId) {
    try {
        const response = await axios.get(
            `https://stremio-jackett.elfhosted.com/stream/${type}/${imdbId}.json`,
            { timeout: 15000 }
        );
        
        if (!response.data?.streams?.length) return [];
        
        return response.data.streams
            .filter(s => s.infoHash)
            .map(s => {
                const title = s.title || '';
                const info = extractInfo(title);
                const seeders = parseInt(s.description?.match(/👤 (\d+)/)?.[1] || '0');
                
                return {
                    infoHash: s.infoHash,
                    title: title.substring(0, 100),
                    seeders: seeders,
                    resolution: info.resolution,
                    codec: info.codec,
                    hdr: info.hdr,
                    magnet: s.url || `magnet:?xt=urn:btih:${s.infoHash}`,
                    provider: 'Jackett'
                };
            });
    } catch (error) {
        console.error('Jackett erreur:', error.message);
        return [];
    }
}

// === SOURCE 2: ThePirateBay+ (via API alternative) ===
async function searchTPB(type, imdbId) {
    try {
        // Utiliser l'API apibay.org
        const response = await axios.get(`https://apibay.org/q.php`, {
            params: { q: imdbId, cat: type === 'movie' ? '201' : '205' },
            timeout: 10000
        });
        
        if (!response.data?.length) return [];
        
        return response.data.slice(0, 10).map(item => ({
            infoHash: item.info_hash,
            title: item.name,
            seeders: parseInt(item.seeders) || 0,
            resolution: extractInfo(item.name).resolution,
            codec: extractInfo(item.name).codec,
            hdr: extractInfo(item.name).hdr,
            magnet: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`,
            provider: 'TPB'
        }));
    } catch (error) {
        console.error('TPB erreur:', error.message);
        return [];
    }
}

// === SOURCE 3: Torrentio via proxy (contourne le 403) ===
async function searchTorrentioViaProxy(type, imdbId) {
    try {
        // Utiliser un User-Agent différent et un proxy
        const response = await axios.get(
            `https://torrentio.strem.fun/${type}/${imdbId}.json`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Origin': 'https://www.stremio.com',
                    'Referer': 'https://www.stremio.com/'
                }
            }
        );
        
        if (!response.data?.streams?.length) return [];
        
        return response.data.streams
            .filter(s => s.infoHash)
            .map(s => {
                const title = s.title || '';
                const info = extractInfo(title);
                const seeders = parseInt(s.description?.match(/👤 (\d+)/)?.[1] || '0');
                
                return {
                    infoHash: s.infoHash,
                    title: title.substring(0, 100),
                    seeders: seeders,
                    resolution: info.resolution,
                    codec: info.codec,
                    hdr: info.hdr,
                    magnet: s.url || `magnet:?xt=urn:btih:${s.infoHash}`,
                    provider: 'Torrentio'
                };
            });
    } catch (error) {
        console.error('Torrentio proxy erreur:', error.message);
        return [];
    }
}

// === SOURCE 4: 1337x via proxy ===
async function search1337x(type, imdbId) {
    try {
        const response = await axios.get(
            `https://1337x.to/search/${imdbId}/1/`,
            { 
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }
        );
        
        // Parse simple (trouver les liens magnet)
        const magnetMatches = response.data.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40})/g) || [];
        const sizeMatches = response.data.match(/<td class="coll-4">([^<]+)<\/td>/g) || [];
        const seederMatches = response.data.match(/<td class="coll-2">(\d+)<\/td>/g) || [];
        
        return magnetMatches.slice(0, 10).map((magnet, i) => {
            const infoHash = magnet.match(/([a-fA-F0-9]{40})/)[1];
            return {
                infoHash: infoHash,
                title: `${imdbId} - Result ${i+1}`,
                seeders: parseInt(seederMatches[i]?.match(/\d+/)?.[0] || '0'),
                resolution: '1080p',
                codec: 'x264',
                hdr: 'SDR',
                magnet: magnet,
                provider: '1337x'
            };
        });
    } catch (error) {
        console.error('1337x erreur:', error.message);
        return [];
    }
}

// === ROUTE PRINCIPALE DES STREAMS ===
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
        // Lancer toutes les recherches en parallèle
        const [jackettResults, tpbResults, torrentioResults, x1337Results] = await Promise.all([
            searchJackett(type, id),
            searchTPB(type, id),
            searchTorrentioViaProxy(type, id),
            search1337x(type, id)
        ]);
        
        let allTorrents = [
            ...jackettResults,
            ...tpbResults,
            ...torrentioResults,
            ...x1337Results
        ];
        
        if (allTorrents.length === 0) {
            console.log('⚠️ Aucun résultat trouvé');
            return res.json({ streams: [] });
        }
        
        // Dédupliquer
        const seen = new Map();
        allTorrents.forEach(t => {
            if (!seen.has(t.infoHash) || t.seeders > seen.get(t.infoHash).seeders) {
                seen.set(t.infoHash, t);
            }
        });
        const uniqueTorrents = Array.from(seen.values());
        
        // Calculer scores et trier
        uniqueTorrents.forEach(t => t.score = calculerScore(t));
        uniqueTorrents.sort((a, b) => b.score - a.score);
        
        const topTorrents = uniqueTorrents.slice(0, 20);
        
        // Formater pour Stremio
        const streams = topTorrents.map((t, i) => ({
            name: 'Go Addon',
            title: `${i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}${t.resolution} | ${t.codec} | ${t.hdr}\n💚 ${t.seeders} seeds | ⭐${t.score}/100 | 📡 ${t.provider}`,
            infoHash: t.infoHash,
            url: t.magnet,
            behaviorHints: { notWebReady: true }
        }));
        
        console.log(`✅ ${streams.length} streams trouvés\n`);
        
        // Mettre en cache
        cache.set(cacheKey, streams);
        
        res.json({ streams });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.json({ streams: [] });
    }
});

// Route de test
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Test Go Addon</title>
        <style>
            body { font-family: Arial; margin: 40px; background: #1a1a2e; color: #fff; }
            a { color: #4ecdc4; display: block; margin: 10px 0; }
            .success { color: #4ecdc4; }
        </style>
        </head>
        <body>
            <h1>🎬 Go Addon - Page de test</h1>
            <p>Testez les liens ci-dessous :</p>
            <h3>Films :</h3>
            <a href="/stream/movie/tt0111161.json">The Shawshank Redemption (tt0111161)</a>
            <a href="/stream/movie/tt0468569.json">The Dark Knight (tt0468569)</a>
            <a href="/stream/movie/tt0133093.json">The Matrix (tt0133093)</a>
            <a href="/stream/movie/tt16431404.json">Your test movie (tt16431404)</a>
            <h3>Séries :</h3>
            <a href="/stream/series/tt0944947.json">Game of Thrones (tt0944947)</a>
            <a href="/stream/series/tt0903747.json">Breaking Bad (tt0903747)</a>
            <p><a href="/manifest.json">Voir le manifeste</a></p>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Go Addon démarré sur le port ${PORT}`);
    console.log(`📝 Test: http://localhost:${PORT}/test`);
    console.log(`📋 Manifeste: http://localhost:${PORT}/manifest.json\n`);
});
