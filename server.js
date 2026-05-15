const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });
const TIMEOUT = 7000;

// ---------------- MANIFEST ----------------
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

// ---------------- SOURCES ----------------
const SOURCES = [
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Torrent-Dz: S1' },
    { url: 'https://filmora-production.up.railway.app', name: 'Torrent-Dz: S2' },
    { url: 'https://str.zmb.lat/lite', name: 'Torrent-Dz: S3' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Torrent-Dz: S4' },
];

// ---------------- HELPERS ----------------
function getPeerSite(title = '') {
    const t = title.toLowerCase();
    if (t.includes('yts') || t.includes('yify')) return 'YTS';
    if (t.includes('tpb')) return 'TPB';
    if (t.includes('1337x')) return '1337X';
    if (t.includes('rarbg')) return 'RARBG';
    return 'P2P';
}

// -------- FILE SIZE FILTER --------
function getFileSize(title) {
    if (!title) return null;

    const t = title.replace(/,/g, '.');
    const match = t.match(/\b(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|TIB|GIB|MIB|KIB)\b/i);

    if (!match) return null;

    let size = parseFloat(match[1]);
    let unit = match[2].toUpperCase();

    unit = unit.replace('TIB', 'TB')
               .replace('GIB', 'GB')
               .replace('MIB', 'MB')
               .replace('KIB', 'KB');

    return `💾= ${size}${unit}`;
}

// -------- SEEDERS --------
function getSeeders(title = '') {
    const t = title.toLowerCase();
    if (t.includes('unknown')) return 0;

    const match = t.match(/(?:👤|👥|seeders?|seeds?|s)\s*[:=]?\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
}

// -------- FAKE FILTER --------
function isFakeTorrent(title = '') {
    const t = title.toLowerCase();
    const bad = ['sample', 'trailer', 'fake', 'test', 'promo'];
    return bad.some(p => t.includes(p));
}

// -------- ONLY REAL MOVIES --------
function isRealMovie(title = '') {
    return /(720p|1080p|2160p|4k|bluray|web|hdr|x264|x265|hevc)/i.test(title);
}

// -------- QUALITY INFO --------
function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🎧= ❓';

    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else if (t.includes('web-dl') || t.includes('webdl')) quality = '🌐:WEB-DL';
    else quality = '🎥:HD';

    if (t.includes('bluray')) extra.push('💿BluRay');
    if (t.includes('remux')) extra.push('📀REMUX');
    if (t.includes('hevc') || t.includes('x265')) extra.push('HEVC');
    if (t.includes('x264')) extra.push('X264');
    if (t.includes('hdr')) extra.push('HDR');
    if (t.includes('atmos')) extra.push('ATMOS');

    return { quality, extra: extra.join('|'), lang };
}

// ---------------- STREAM ROUTE ----------------
app.get('/stream/:type/:id.json', async (req, res) => {

    const cacheKey = `${req.params.type}-${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const seen = new Set();

    const promises = SOURCES.map(source =>
        axios.get(`${source.url}/stream/${req.params.type}/${req.params.id}.json`, {
            timeout: TIMEOUT
        }).then(r => {

            if (!r.data?.streams) return [];

            let sourceStreams = [];
            const qualityLimit = {};

            for (const stream of r.data.streams) {

                const raw = stream.title || '';

                if (isFakeTorrent(raw)) continue;
                if (!isRealMovie(raw)) continue;

                const size = getFileSize(raw);
                if (!size) continue;

                const info = getQualityInfo(raw);
                const qTag = info.quality.split(':')[1];

                qualityLimit[qTag] = (qualityLimit[qTag] || 0) + 1;
                if (qualityLimit[qTag] > 5) continue;

                const seeds = getSeeders(raw);
                const site = getPeerSite(raw);

                let hash = stream.infoHash || '';
                if (!hash && stream.url?.includes('magnet')) {
                    const m = stream.url.match(/btih:([a-fA-F0-9]+)/);
                    if (m) hash = m[1];
                }

                if (!hash && !stream.url) continue;

                const name = raw.split('\n')[0] || 'Unknown';

                const key = `${name}-${qTag}`;
                if (seen.has(key)) continue;
                seen.add(key);

                sourceStreams.push({
                    name: `${source.name} | ${qTag}`,
                    title: `${name}\n${size} | 👤= ${seeds} | 🌐= ${site}\n${info.lang}\n⚙️= ${info.extra || 'STD'}`,
                    infoHash: hash ? hash.toLowerCase() : undefined,
                    url: !hash ? stream.url : undefined,
                    behaviorHints: { notWebReady: true, bingeGroup: 'dz' }
                });
            }

            return sourceStreams;
        }).catch(() => [])
    );

    let results = await Promise.all(promises);
    let streams = results.flat();

    streams.sort((a, b) => {
        const qa = (a.name.includes('4K') ? 10 : 1);
        const qb = (b.name.includes('4K') ? 10 : 1);
        return qb - qa;
    });

    const response = { streams };
    cache.set(cacheKey, response);
    res.json(response);
});

// ---------------- MANIFEST ----------------
app.get('/manifest.json', (req, res) => {
    res.json(MANIFEST);
});

// ---------------- HOME ----------------
app.get('/', (req, res) => {
    res.send(`<h1>Torrent DZ Ready 🚀</h1>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Torrent DZ ONLINE 🚀'));
