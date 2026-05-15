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

function getPeerSite(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('yts') || t.includes('yify') || t.includes('yifi')) return 'YTS';
    if (t.includes('1337x')) return '1337X';
    if (t.includes('torrentgalaxy')) return 'TGX';
    if (t.includes('nyaa')) return 'NYAA';
    return 'P2P';
}

/* ===================== FILE SIZE ===================== */
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

/* ===================== SEEDERS (FIX + IGNORE UNKNOWN) ===================== */
function getSeeders(title) {
    if (!title) return 0;

    const t = String(title).toLowerCase();
    if (t.includes('unknown')) return 0;

    const match = t.match(/(?:👤|👥|seeders?|seeds?|s)\s*[:=]?\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
}

/* ===================== QUALITY SCORE ===================== */
function getQualityScore(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('4k') || t.includes('2160p')) return 10;
    if (t.includes('1080p')) return 7;
    if (t.includes('720p')) return 5;
    return 1;
}

/* ===================== QUALITY INFO (FULL VERSION) ===================== */
function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🎧= ❓🔉';

    const languages = {
        fr: { flag: '🇫🇷', names: ['french','vf','vff','francais'], label: 'VF' },
        en: { flag: '🇺🇸', names: ['english','en','eng','anglais'], label: 'VO' },
        es: { flag: '🇪🇸', names: ['spanish','es','spa'] },
        it: { flag: '🇮🇹', names: ['italian','it','ita'] },
        ar: { flag: '🇩🇿', names: ['arabic','ar','ara'] },
        ru: { flag: '🇷🇺', names: ['russian','ru','rus'] }
    };

    const found = Object.entries(languages)
        .filter(([code, data]) =>
            t.includes(code) || data.names.some(n => t.includes(n))
        )
        .map(([code]) => code);

    if (found.length >= 2) lang = `🎧= ${found.map(c => languages[c].flag).join('/')}`;
    else if (found.length === 1) lang = `🎧= ${languages[found[0]].flag}`;

    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else quality = '🎥:HD';

    if (t.includes('bluray') || t.includes('bdrip')) extra.push('💿BluRay');
    if (t.includes('remux')) extra.push('📀REMUX');
    if (t.includes('web-dl')) extra.push('🌐WEB-DL');
    if (t.includes('webrip')) extra.push('🌍WEBRip');
    if (t.includes('x265') || t.includes('hevc')) extra.push('HEVC');
    if (t.includes('x264')) extra.push('X264');
    if (t.includes('hdr')) extra.push('HDR');
    if (t.includes('atmos')) extra.push('ATMOS');
    if (t.includes('sub')) extra.push('SUB');

    return { quality, extra: extra.join('|'), lang };
}

/* ===================== FILTER: ONLY REAL MOVIES ===================== */
function isFakeTorrent(title = '') {
    const t = title.toLowerCase();

    const fakeKeywords = [
        'sample', 'trailer', 'test', 'cam sample', 'fake', 'password', 'readme'
    ];

    return fakeKeywords.some(k => t.includes(k));
}

/* ===================== STREAM ===================== */
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const promises = SOURCES.map(source =>
        axios.get(`${source.url}/stream/${type}/${id}.json`, { timeout: TIMEOUT })
        .then(res => res.data.streams || [])
        .catch(() => [])
    );

    const results = await Promise.all(promises);
    let allStreams = results.flat();

    const seen = new Set();
    let finalStreams = [];

    for (const stream of allStreams) {
        const rawTitle = stream.title || '';

        /* ❌ FILTERS */
        if (!getFileSize(rawTitle)) continue;
        if (isFakeTorrent(rawTitle)) continue;

        const info = getQualityInfo(rawTitle);
        const size = getFileSize(rawTitle);
        const seeds = getSeeders(rawTitle);
        const peer = getPeerSite(rawTitle);

        let infoHash = stream.infoHash || '';
        if (!infoHash && !stream.url) continue;

        const key = infoHash || stream.url;
        if (seen.has(key)) continue;
        seen.add(key);

        const fileName = rawTitle.split('\n')[0] || 'Unknown';

        finalStreams.push({
            name: `${source?.name || 'Torrent'} | ${info.quality.split(':')[1]}`,
            title:
`${fileName}
${size} | 👤= ${seeds} | 🌐= ${peer}
${info.lang}
⚙️= ${info.extra || 'Standard'}`,
            infoHash: infoHash ? infoHash.toLowerCase() : undefined,
            url: !infoHash ? stream.url : undefined,
            behaviorHints: { notWebReady: true, bingeGroup: 'link-dz' }
        });
    }

    finalStreams.sort((a, b) => {
        const qA = getQualityScore(a.title);
        const qB = getQualityScore(b.title);
        if (qB !== qA) return qB - qA;

        const sA = getSeeders(a.title);
        const sB = getSeeders(b.title);
        return sB - sA;
    });

    const result = { streams: finalStreams };
    cache.set(cacheKey, result);
    res.json(result);
});

app.get('/manifest.json', (req, res) => {
    res.json(MANIFEST);
});

app.listen(3000, () => console.log('Torrent DZ ONLINE'));
