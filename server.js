const express = require('express');
const cors = require('cors');
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 1800 }); // Cache 30 minutes
const PORT = process.env.PORT || 3000;

// Activer CORS
app.use(cors());

// Builder Stremio
const builder = new addonBuilder({
    id: 'org.stremio.torrent-aggregator',
    version: '1.0.0',
    name: '🎬 Torrent Aggregator',
    description: 'Meilleurs torrents classés par qualité (4K, 1080p, seeders...)',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
});

// Fonction de calcul du score
function calculerScore(torrent) {
    let score = 0;
    
    // Résolution (40 points max)
    if (torrent.resolution === '2160p' || torrent.resolution === '4K') score += 40;
    else if (torrent.resolution === '1080p') score += 30;
    else if (torrent.resolution === '720p') score += 20;
    else score += 10;
    
    // Seeders (30 points max)
    if (torrent.seeders >= 100) score += 30;
    else if (torrent.seeders >= 50) score += 25;
    else if (torrent.seeders >= 20) score += 20;
    else if (torrent.seeders >= 10) score += 15;
    else if (torrent.seeders >= 5) score += 10;
    else score += 5;
    
    // Codec (15 points max)
    if (torrent.codec && (torrent.codec.includes('HEVC') || torrent.codec.includes('x265') || torrent.codec.includes('h265'))) score += 15;
    else if (torrent.codec && (torrent.codec.includes('x264') || torrent.codec.includes('AVC'))) score += 10;
    else score += 5;
    
    // HDR (15 points max)
    if (torrent.hdr) {
        if (torrent.hdr.includes('DV') || torrent.hdr.includes('Dolby Vision')) score += 15;
        else if (torrent.hdr.includes('HDR10') || torrent.hdr.includes('HDR')) score += 12;
        else score += 8;
    }
    
    return score;
}

// Extraction des informations depuis le titre
function extraireInfo(title) {
    const info = {};
    
    // Résolution
    if (title.includes('2160p') || title.includes('4K') || title.includes('UHD')) info.resolution = '2160p';
    else if (title.includes('1080p')) info.resolution = '1080p';
    else if (title.includes('720p')) info.resolution = '720p';
    else info.resolution = '1080p';
    
    // Codec
    if (title.match(/HEVC|HEVC|x265|h265/i)) info.codec = 'HEVC';
    else if (title.match(/x264|h264|AVC/i)) info.codec = 'x264';
    else info.codec = 'x264';
    
    // HDR
    if (title.includes('DV') || title.includes('Dolby Vision')) info.hdr = 'DV';
    else if (title.includes('HDR10+')) info.hdr = 'HDR10+';
    else if (title.includes('HDR')) info.hdr = 'HDR';
    else info.hdr = 'SDR';
    
    // Seeders (extraire de la description)
    info.seeders = 0;
    
    return info;
}

// Source 1: Torrentio
async function searchTorrentio(type, imdbId) {
    try {
        const response = await axios.get(`https://torrentio.strem.fun/${type}/${imdbId}.json`, {
            timeout: 10000
        });
        
        if (!response.data?.streams) return [];
        
        return response.data.streams
            .filter(s => s.infoHash)
            .map(s => {
                const title = s.title || '';
                const info = extraireInfo(title);
                
                return {
                    infoHash: s.infoHash,
                    title: `${info.resolution} | ${info.codec} | ${info.hdr}`,
                    size: 0,
                    seeders: s.description?.match(/👤 (\d+)/)?.[1] || 0,
                    leechers: 0,
                    resolution: info.resolution,
                    codec: info.codec,
                    hdr: info.hdr,
                    magnet: s.url || `magnet:?xt=urn:btih:${s.infoHash}`,
                    provider: 'Torrentio'
                };
            });
    } catch (error) {
        console.error('Erreur Torrentio:', error.message);
        return [];
    }
}

// Source 2: YTS (films uniquement)
async function searchYTS(imdbId) {
    try {
        if (!imdbId.startsWith('tt')) return [];
        
        const response = await axios.get('https://yts.mx/api/v2/list_movies.json', {
            params: { 
                query_term: imdbId,
                limit: 10 
            },
            timeout: 10000
        });
        
        if (!response.data?.data?.movies) return [];
        
        let torrents = [];
        for (const movie of response.data.data.movies) {
            if (movie.torrents) {
                for (const t of movie.torrents) {
                    torrents.push({
                        infoHash: t.hash,
                        title: `${t.quality} | x264 | SDR`,
                        size: t.size_bytes,
                        seeders: t.seeds,
                        leechers: t.peers,
                        resolution: t.quality,
                        codec: 'x264',
                        hdr: 'SDR',
                        magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://tracker.opentrackr.org:1337/announce`,
                        provider: 'YTS'
                    });
                }
            }
        }
        return torrents;
    } catch (error) {
        console.error('Erreur YTS:', error.message);
        return [];
    }
}

// Source 3: 1337x via API alternative
async function search1337x(type, imdbId) {
    try {
        // Utiliser une API publique
        const response = await axios.get(`https://api.prowlarr.com/api/v1/search`, {
            params: {
                query: imdbId,
                type: type === 'movie' ? 'movie' : 'tv',
                limit: 10
            },
            timeout: 10000
        });
        
        // Format simplifié si l'API répond
        return [];
    } catch (error) {
        return [];
    }
}

// Handler principal des streams
builder.defineStreamHandler(async (args) => {
    const cacheKey = `${args.type}_${args.id}`;
    
    // Vérifier le cache
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`✓ Cache hit pour ${args.id}`);
        return Promise.resolve({ streams: cached });
    }
    
    console.log(`🔍 Recherche: ${args.type} ${args.id}`);
    
    try {
        // Lancer toutes les recherches en parallèle
        const [torrentioResults, ytsResults] = await Promise.all([
            searchTorrentio(args.type, args.id),
            args.type === 'movie' ? searchYTS(args.id) : Promise.resolve([])
        ]);
        
        // Fusionner tous les résultats
        let allTorrents = [...torrentioResults, ...ytsResults];
        
        // Dédupliquer par infoHash
        const seen = new Map();
        const uniqueTorrents = [];
        allTorrents.forEach(torrent => {
            if (!seen.has(torrent.infoHash) || torrent.seeders > seen.get(torrent.infoHash).seeders) {
                seen.set(torrent.infoHash, torrent);
            }
        });
        uniqueTorrents.push(...Array.from(seen.values()));
        
        // Calculer les scores
        const scoredTorrents = uniqueTorrents.map(torrent => ({
            ...torrent,
            score: calculerScore(torrent)
        }));
        
        // Trier par score (meilleurs en premier)
        scoredTorrents.sort((a, b) => b.score - a.score);
        
        // Limiter à 20 résultats
        const topTorrents = scoredTorrents.slice(0, 20);
        
        // Formater pour Stremio
        const streams = topTorrents.map((torrent, index) => {
            let title = '';
            
            // Ajouter médaille pour les top 3
            if (index === 0) title += '🥇 ';
            else if (index === 1) title += '🥈 ';
            else if (index === 2) title += '🥉 ';
            
            // Informations de qualité
            title += `${torrent.resolution}`;
            if (torrent.hdr !== 'SDR') title += ` ${torrent.hdr}`;
            title += ` | ${torrent.codec}`;
            title += `\n💚 ${torrent.seeders} seeds`;
            title += ` | ⭐ Score: ${torrent.score}/100`;
            title += `\n📡 ${torrent.provider}`;
            
            return {
                name: 'Torrent Aggregator',
                title: title,
                infoHash: torrent.infoHash,
                url: torrent.magnet,
                behaviorHints: {
                    notWebReady: true,
                    bingeGroup: `${args.type}-${torrent.resolution}`
                }
            };
        });
        
        console.log(`✅ ${streams.length} streams trouvés pour ${args.id}`);
        
        // Mettre en cache
        cache.set(cacheKey, streams);
        
        return Promise.resolve({ streams });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        return Promise.resolve({ streams: [] });
    }
});

// Route de santé pour Render
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        uptime: process.uptime(),
        cache: cache.getStats()
    });
});

// Démarrer le serveur
const addonInterface = builder.getInterface();
serveHTTP(addonInterface, { 
    port: PORT,
    express: app 
});

console.log(`🚀 Addon démarré sur le port ${PORT}`);