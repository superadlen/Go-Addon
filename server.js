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
    version: '2.5.9', 
    name: 'Torrent♦️Dz',
    description: 'Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'],
    catalogs: [],
    logo: 'https://i.pinimg.com/1200x/45/26/88/45268878ba1c1123ee8621b2d0081fab.jpg'
};

const SOURCES = [
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Torrent-Dz:1' },
    { url: 'https://filmora-production.up.railway.app', name: 'Torrent-Dz:2' },
    { url: 'https://str.zmb.lat/lite', name: 'Torrent-Dz:3' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Torrent-Dz:4' },
    { url: 'https://stremthru.stremio.ru/stremio/torz/eyJpbmRleGVycyI6bnVsbCwic3RvcmVzIjpbeyJjIjoicDJwIiwidCI6IiJ9XSwiZmlsdGVyIjoiRmlsZS5TaXplIFx1MDAzYz0gXCI4IEdCXCIgXHUwMDI2XHUwMDI2IFNlZWRlcnMgXHUwMDNlPSA1MCJ9/', name: 'Torrent-Dz:5' },
    { url: 'https://thepiratebay-plus.strem.fun', name: 'Torrent-Dz:6' },
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
    if (t.includes('kickass')) return 'KAT';
    return 'P2P';
}

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
    if (t.includes('4k') || t.includes('2160p')) return 10;
    if (t.includes('1080p')) return 7;
    if (t.includes('720p')) return 5;
    return 1;
}

function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🎧= ❓🔉';

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

    if (found.length >= 2) {
        lang = `🎧= ${found.map(code => languages[code].flag).join('/')} `;
    } else if (t.includes('multi')) {
        lang = '🎧= 🌍 MULTI ';
    } else if (found.length === 1) {
        const code = found[0];
        lang = `🎧= ${languages[code].flag}${code === 'fr' ? ' VF' : (code === 'en' ? ' VO' : '')}`;
    }

    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
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
                for (const stream of response.data.streams) {
                    const rawTitle = stream.title || '';
                    const info = getQualityInfo(rawTitle);
                    const size = getFileSize(rawTitle);
                    const seedsCount = getSeeders(rawTitle);
                    const peerSite = getPeerSite(rawTitle || stream.name || '');
                    
                    let infoHash = stream.infoHash || '';
                    if (!infoHash && stream.url?.startsWith('magnet:')) {
                        const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                        if (match) infoHash = match[1];
                    }
                    if (!infoHash && !stream.url) continue;

                    // Extraction du nom de fichier propre (sans les sauts de ligne de la source)
                    const fileName = rawTitle.split('\n')[0] || stream.name || 'Unknown File';
                    const qualityText = info.quality.split(':')[1].toUpperCase();

                    sourceStreams.push({
                        // Affiche : Torrent-Dz:X (ligne 1) et QUALITE (ligne 2)
                        name: `${source.name} |  ${qualityText}`,
                        // Affiche : Nom du fichier (ligne 1), puis Stats, puis Langue, puis Codecs
                        title: `${fileName}\n${size} | 👤= ${seedsCount} | 🌐= ${peerSite}\n${info.lang}\n⚙️= ${info.extra || '📦Standard'}`,
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: { notWebReady: true, bingeGroup: `link-dz` }
                    });

                    if (sourceStreams.length >= 20) break;
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
app.listen(PORT, () => console.log(`⚡ Torrent♦️Dz v2.5.9 Online`));
