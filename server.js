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
    version: '2.6.6', 
    name: 'Torrent♦️Dz',
    description: 'Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'],
    catalogs: [],
    logo: 'https://i.pinimg.com/736x/25/42/be/2542be2c309b788b081c80d0d734e571.jpg'
};

const SOURCES = [
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Torrent-Dz: S1' },
    { url: 'https://filmora-production.up.railway.app', name: 'Torrent-Dz: S2' },
    { url: 'https://str.zmb.lat/lite', name: 'Torrent-Dz: S3' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Torrent-Dz: S4' },
];

/* ================= HELPERS ================= */

function getPeerSite(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('yts')) return 'YTS';
    if (t.includes('tpb')) return 'TPB';
    return 'P2P';
}

function getFileSize(title) {
    if (!title) return null;

    const t = title.replace(/,/g, '.');
    const match = t.match(/\b(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|TIB|GIB|MIB|KIB)\b/i);

    if (!match) return null;

    let size = parseFloat(match[1]);
    let unit = match[2].toUpperCase();

    unit = unit
        .replace('TIB', 'TB')
        .replace('GIB', 'GB')
        .replace('MIB', 'MB')
        .replace('KIB', 'KB');

    return `💾= ${size}${unit}`;
}

function getSeeders(title) {
    if (!title) return 0;
    const match = String(title).match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function getQualityScore(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('4k') || t.includes('2160p')) return 10;
    if (t.includes('1080p')) return 7;
    if (t.includes('720p')) return 5;
    return 1;
}

/* ================= STREAM ================= */

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const promises = SOURCES.map(source =>
        axios.get(`${source.url}/stream/${type}/${id}.json`, {
            timeout: TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        .then(response => {

            /* ================= DEAD SOURCE FILTER ================= */
            if (
                !response ||
                !response.data ||
                !Array.isArray(response.data.streams)
            ) {
                return [];
            }

            const sourceStreams = [];
            const sourceQualityCounts = {};

            for (const stream of response.data.streams) {
                const rawTitle = stream.title || stream.name || '';

                const size = getFileSize(rawTitle);
                if (!size) continue;

                const qTag = (rawTitle.match(/(4k|2160p|1080p|720p)/i) || ['HD'])[0].toUpperCase();

                sourceQualityCounts[qTag] = (sourceQualityCounts[qTag] || 0) + 1;
                if (sourceQualityCounts[qTag] > 5) continue;

                const seedsCount = getSeeders(rawTitle);
                const peerSite = getPeerSite(rawTitle);

                let infoHash = stream.infoHash || '';
                if (!infoHash && stream.url?.startsWith('magnet:')) {
                    const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                    if (match) infoHash = match[1];
                }

                if (!infoHash && !stream.url) continue;

                const fileName = rawTitle.split('\n')[0] || 'Unknown File';

                sourceStreams.push({
                    name: `${source.name} | ${qTag}`,
                    title: `${fileName}\n${size} | 👤= ${seedsCount} | 🌐= ${peerSite}`,
                    infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                    url: !infoHash ? stream.url : undefined,
                    behaviorHints: { notWebReady: true }
                });
            }

            return sourceStreams;
        })
        .catch(() => {
            /* ================= DEAD SOURCE ================= */
            return [];
        })
    );

    const results = await Promise.all(promises);
    let allStreams = results.flat();

    const seen = new Set();
    allStreams = allStreams.filter(s => {
        const key = s.infoHash || s.url;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    allStreams.sort((a, b) => {
        const qA = getQualityScore(a.title);
        const qB = getQualityScore(b.title);
        if (qB !== qA) return qB - qA;
        return getSeeders(b.title) - getSeeders(a.title);
    });

    const result = { streams: allStreams };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('⚡ Torrent♦️Dz Online'));
