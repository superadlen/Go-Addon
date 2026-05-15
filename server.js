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
    name: 'Torrent♦️GT',
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
    if (t.includes('thepiratebay') || t.includes('tpb')) return 'TPB';
    if (t.includes('1337x')) return '1337X';
    if (t.includes('rutor')) return 'RUTOR';
    if (t.includes('rarbg')) return 'RARBG';
    if (t.includes('torrentgalaxy') || t.includes('tgx')) return 'TGX';
    if (t.includes('eztv')) return 'EZTV';
    if (t.includes('nyaa')) return 'NYAA';
    if (t.includes('torrentleech')) return 'TL';
    if (t.includes('kickass') || t.includes('kat')) return 'KAT';
    if (t.includes('zooqle')) return 'ZOOQLE';
    if (t.includes('limetorrents')) return 'LIME';
    if (t.includes('torlock')) return 'TORLOCK';
    if (t.includes('torrentdownloads')) return 'TD';
    if (t.includes('magnetdl')) return 'MAGNETDL';
    if (t.includes('idope')) return 'IDOPE';
    if (t.includes('rutracker')) return 'RUTRACKER';
    if (t.includes('solidtorrents')) return 'SOLID';
    if (t.includes('bitsearch')) return 'BITSEARCH';
    if (t.includes('torrentfunk')) return 'TFUNK';
    if (t.includes('glodls')) return 'GLODLS';
    if (t.includes('ettv')) return 'ETTV';
    if (t.includes('psa')) return 'PSA';
    if (t.includes('rmteam')) return 'RMTEAM';
    if (t.includes('galaxyrg')) return 'GALAXYRG';
    if (t.includes('megusta')) return 'MEGUSTA';
    if (t.includes('tigole')) return 'TIGOLE';
    if (t.includes('qxr')) return 'QXR';
    if (t.includes('utr')) return 'UTR';
    return 'P2P';
}

/* ================= SIZE ================= */
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

/* ================= SEEDERS ================= */
function getSeeders(title) {
    if (!title) return 0;
    const t = String(title).toLowerCase();
    if (t.includes('unknown')) return 0;

    const match = t.match(/(?:👤|👥|seeders?|seeds?|s)\s*[:=]?\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
}

/* ================= QUALITY ================= */
function getQualityScore(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('4k') || t.includes('2160p')) return 10;
    if (t.includes('1080p')) return 7;
    if (t.includes('720p')) return 5;
    return 1;
}

/* ================= QUALITY INFO ================= */
function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🎧= ❓Muti';

    const languages = {
        fr: { flag: '🇫🇷', names: ['french', ' vf ', ' vff ', 'francais'], label: 'VF' },
        en: { flag: '🇺🇸', names: ['english', ' en ', ' eng ', 'anglais'], label: 'VO' },
        es: { flag: '🇪🇸', names: ['spanish', ' es ', ' spa ', 'espanol'] },
        it: { flag: '🇮🇹', names: ['italian', ' it ', ' ita ', 'italiano'] },
        pt: { flag: '🇵🇹', names: ['portuguese', ' pt ', ' por ', 'portugues'] },
        ru: { flag: '🇷🇺', names: ['russian', ' ru ', ' rus ', 'russe'] },
        de: { flag: '🇩🇪', names: ['german', ' de ', ' ger ', 'deutsch'] },
        ja: { flag: '🇯🇵', names: ['japanese', ' ja ', ' jpn ', 'japonais'] },
        zh: { flag: '🇨🇳', names: ['chinese', ' zh ', ' chi ', 'chinois'] },
        ko: { flag: '🇰🇷', names: ['korean', ' ko ', ' kor ', 'coréen'] },
        ar: { flag: '🇩🇿', names: ['arabic', ' ar ', ' ara ', 'arabe'] },
        hi: { flag: '🇮🇳', names: ['hindi', ' hi ', ' hin '] },
        bn: { flag: '🇧🇩', names: ['bengali', ' bn ', ' ben '] },
        vi: { flag: '🇻🇳', names: ['vietnamese', ' vi ', ' vie '] },
        th: { flag: '🇹🇭', names: ['thai', ' th ', ' tha '] },
        id: { flag: '🇮🇩', names: ['indonesian', ' id ', ' ind '] },
        tr: { flag: '🇹🇷', names: ['turkish', ' tr ', ' tur '] },
        nl: { flag: '🇳🇱', names: ['dutch', ' nl ', ' dut '] },
        pl: { flag: '🇵🇱', names: ['polish', ' pl ', ' pol '] },
        uk: { flag: '🇺🇦', names: ['ukrainian', ' uk ', ' ukr '] },
        ro: { flag: '🇷🇴', names: ['romanian', ' ro ', ' ron '] },
        hu: { flag: '🇭🇺', names: ['hungarian', ' hu ', ' hun '] },
        cs: { flag: '🇨🇿', names: ['czech', ' cs ', ' ces '] },
        sv: { flag: '🇸🇪', names: ['swedish', ' sv ', ' swe '] },
        da: { flag: '🇩🇰', names: ['danish', ' da ', ' dan '] },
        no: { flag: '🇳🇴', names: ['norwegian', ' no ', ' nor '] },
        fi: { flag: '🇫🇮', names: ['finnish', ' fi ', ' fin '] },
        el: { flag: '🇬🇷', names: ['greek', ' el ', ' gre '] },
        fa: { flag: '🇮🇷', names: ['persian', ' fa ', ' per '] },
        sw: { flag: '🇹🇿', names: ['swahili', ' sw ', ' swa '] },
        ta: { flag: '🇮🇳', names: ['tamil', ' ta ', ' tam '] },
        te: { flag: '🇮🇳', names: ['telugu', ' te ', ' tel '] }
    };

    const found = Object.entries(languages)
        .filter(([c, d]) => t.includes(c) || d.names.some(n => t.includes(n)))
        .map(([c]) => c);

    if (found.length >= 2) lang = `🎧= ${found.map(c => languages[c].flag).join('/')}`;
    else if (found.length === 1) lang = `🎧= ${languages[found[0]].flag}`;

    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else if (t.includes('3d')) quality = '👓:3D';
    else if (t.includes('cam')) quality = '📱:CAM';
    else quality = '🎥:HD';

    if (t.includes('bluray') || t.includes('bdrip')) extra.push('💿BluRay');
    if (t.includes('remux')) extra.push('📀REMUX');
    if (t.includes('web-dl') || t.includes('webdl')) extra.push('🌐WEB-DL');
    if (t.includes('webrip')) extra.push('🌍WEBRip');
    if (t.includes('dvdrip')) extra.push('📼DVDRip');
    if (t.includes('hdrip')) extra.push('🎞️HDRip');
    if (t.includes('uhd')) extra.push('🖥️UHD');
    if (t.includes('3d')) extra.push('🔅3D');
    if (t.includes('amzn')) extra.push('🛒AMZN');
    if (t.includes('hevc') || t.includes('x265') || t.includes('h265')) extra.push('HEVC');
    if (t.includes('x264')) extra.push('X264');
    if (t.includes('10bit')) extra.push('🎨10BIT');
    if (t.includes('hdr10')) extra.push('💯HDR10');
    else if (t.includes('hdr')) extra.push('✨HDR');
    if (t.includes('dolby vision') || t.includes(' dv ') || t.includes('.dv.')) extra.push('🌈DolbyVision');
    if (t.includes('atmos')) extra.push('🎧Atmos');
    if (t.includes('ddp5') || t.includes('ddp5.1')) extra.push('🔊DDP5.1');
    if (t.includes('truehd')) extra.push('🎵TrueHD');
    if (t.includes('dts')) extra.push('🔊DTS');
    if (t.includes('aac')) extra.push('🔉AAC');
    if (t.includes('sub') || t.includes('subs') || t.includes('subtitle')) extra.push('💬SUB');
    if (t.includes('dual audio')) extra.push('🎚️Dual Audio');
    if (t.includes('proper')) extra.push('✅PROPER');
    if (t.includes('repack')) extra.push('♻️REPACK');

    return { quality, extra: extra.join('|'), lang };
}

/* ================= FILTER FAKE ================= */
function isFake(title = '') {
    const t = title.toLowerCase();
    return (
        t.includes('sample') ||
        t.includes('trailer') ||
        t.includes('test') ||
        t.includes('fake')
    );
}

/* ================= STREAM ================= */
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const promises = SOURCES.map(source =>
        axios.get(`${source.url}/stream/${type}/${id}.json`, { timeout: TIMEOUT })
        .then(res => (res.data.streams || []).map(s => ({
            ...s,
            sourceName: source.name
        })))
        .catch(() => [])
    );

    const results = await Promise.all(promises);
    let allStreams = results.flat();

    const seen = new Set();
    const final = [];

    for (const stream of allStreams) {
        const rawTitle = stream.title || '';

        if (!getFileSize(rawTitle)) continue;
        if (isFake(rawTitle)) continue;

        const info = getQualityInfo(rawTitle);
        const size = getFileSize(rawTitle);
        const seeds = getSeeders(rawTitle);
        const peer = getPeerSite(rawTitle);

        let key = stream.infoHash || stream.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const fileName = rawTitle.split('\n')[0] || 'Unknown';

        const qTag = info.quality.split(':')[1];

        final.push({
            name: `${stream.sourceName} | ${qTag}`,
            title:
`${fileName}
${size} | 👤= ${seeds} | 🌐= ${peer}
${info.lang}
⚙️= ${info.extra || 'Standard'}`,
            infoHash: stream.infoHash?.toLowerCase(),
            url: stream.url,
            behaviorHints: { notWebReady: true }
        });
    }

    final.sort((a, b) => {
        const qa = getQualityScore(a.title);
        const qb = getQualityScore(b.title);
        if (qb !== qa) return qb - qa;

        return getSeeders(b.title) - getSeeders(a.title);
    });

    cache.set(cacheKey, { streams: final });
    res.json({ streams: final });
});

/* ================= MANIFEST ================= */
app.get('/manifest.json', (req, res) => {
    res.json(MANIFEST);
});

app.listen(3000, () => console.log('Torrent DZ ONLINE FIXED'));
