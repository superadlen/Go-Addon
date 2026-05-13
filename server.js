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
    version: '2.5.1', 
    name: '🧲Link-Dz',
    description: 'Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'],
    catalogs: [],
    logo: 'https://i.pinimg.com/1200x/45/26/88/45268878ba1c1123ee8621b2d0081fab.jpg'
};

const SOURCES = [
    { url: 'https://filmora-production.up.railway.app', name: 'Link-Dz Max' },
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Link-Dz Plus' },
    { url: 'https://str.zmb.lat/lite', name: 'Link-Dz Pro' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Link-Dz Ultra' }
];

function getFileSize(title) {
    const match = (title || '').match(/(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB))/i);
    return match ? `💾= ${match[0].toUpperCase()}` : '💾= N/A';
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function getQualityScore(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('1080p')) return 10;
    if (t.includes('4k') || t.includes('2160p')) return 7;
    if (t.includes('720p')) return 5;
    return 1;
}

function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🗣️= ❓🎧';

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
        ar: { flag: '🇸🇦', names: ['arabic', ' ar ', ' ara ', 'arabe'] },
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
        he: { flag: '🇮🇱', names: ['hebrew', ' he ', ' heb '] },
        fa: { flag: '🇮🇷', names: ['persian', ' fa ', ' per '] },
        sw: { flag: '🇹🇿', names: ['swahili', ' sw ', ' swa '] },
        ta: { flag: '🇮🇳', names: ['tamil', ' ta ', ' tam '] },
        te: { flag: '🇮🇳', names: ['telugu', ' te ', ' tel '] }
    };

    const found = Object.entries(languages)
        .filter(([code, data]) => t.includes(code) || data.names.some(name => t.includes(name)))
        .map(([code]) => code);

    if (found.length >= 5) {
        const flags = found.slice(0, 5).map(code => languages[code].flag).join('/');
        lang = `🗣️🔉= ${flags} `;
    } else if (found.length >= 2) {
        const flags = found.map(code => languages[code].flag).join('/');
        lang = `🗣️🔉= ${flags} `;
    } else if (t.includes('multi')) {
        lang = '🗣️🔉:= 🌍 MULTI ';
    } else if (found.length === 1) {
        const code = found[0];
        const suffix = code === 'fr' ? ' VF' : (code === 'en' ? ' VO' : '');
        lang = `🗣️🔉= ${languages[code].flag}${suffix}`;
    }

    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else if (t.includes('cam')) quality = '📱:CAM';
    else quality = '🎥:HD';

    if (t.includes('bluray') || t.includes('bdrip')) extra.push('💿BluRay');
    if (t.includes('remux')) extra.push('📀REMUX');
    if (t.includes('web-dl') || t.includes('webdl')) extra.push('🌐WEB-DL');
    if (t.includes('webrip')) extra.push('🌍WEBRip');
    if (t.includes('dvdrip')) extra.push('📼DVDRip');
    if (t.includes('hdrip')) extra.push('🎞️HDRip');
    if (t.includes('uhd')) extra.push('🖥️UHD');
    if (t.includes('amzn')) extra.push('🛒AMZN');
    if (t.includes('hevc') || t.includes('x265') || t.includes('h265')) extra.push('HEVC');
    if (t.includes('x264')) extra.push('X264');
    if (t.includes('10bit')) extra.push('🎨10BIT');
    if (t.includes('hdr10')) extra.push('💯HDR10');
    else if (t.includes('hdr')) extra.push('✨HDR');
    if (t.includes('dolby vision') || t.includes(' dv ') || t.includes('.dv.')) extra.push('🌈DV');
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

app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(MANIFEST);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const cacheKey = `${type}-${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    const promises = SOURCES.map(source => 
        axios.get(`${source.url}/stream/${type}/${id}.json`, { timeout: TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then(response => {
            if (response.data?.streams) {
                let sourceStreams = [];
                let qualityCount = {}; // Pour limiter à 5 par qualité

                for (const stream of response.data.streams) {
                    const info = getQualityInfo(stream.title || '');
                    
                    // Limite : 5 par qualité
                    qualityCount[info.quality] = (qualityCount[info.quality] || 0) + 1;
                    if (qualityCount[info.quality] > 5) continue;

                    const size = getFileSize(stream.title || '');
                    const seedsCount = getSeeders(stream.title || '');
                    
                    let infoHash = stream.infoHash || '';
                    if (!infoHash && stream.url?.startsWith('magnet:')) {
                        const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                        if (match) infoHash = match[1];
                    }
                    if (!infoHash && !stream.url) continue;

                    sourceStreams.push({
                        name: `${source.name}\n${info.quality.split(':')[1]}`,
                        title: `${size} | ${info.quality}\n👤= ${seedsCount}\n${info.lang}\n⚙️= ${info.extra || '📦Standard'}`,
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: { notWebReady: true, bingeGroup: `link-dz` }
                    });

                    // Limite : 15 par source
                    if (sourceStreams.length >= 15) break;
                }
                return sourceStreams;
            }
            return [];
        })
        .catch(() => [])
    );
    
    const results = await Promise.all(promises);
    let allStreams = results.flat();
    
    const seen = new Set();
    allStreams = allStreams.filter(s => {
        const key = s.infoHash || s.url;
        if (key && !seen.has(key)) { seen.add(key); return true; }
        return false;
    });
    
    allStreams.sort((a, b) => {
        const qA = getQualityScore(a.name + a.title);
        const qB = getQualityScore(b.name + b.title);
        if (qB !== qA) return qB - qA;
        return getSeeders(b.title) - getSeeders(a.title);
    });
    
    const result = { streams: allStreams };
    cache.set(cacheKey, result);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Link-Dz v2.5.0 Online`));
