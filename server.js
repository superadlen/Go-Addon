const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });
const TIMEOUT = 2000;

const MANIFEST = {
    id: 'org.golink.payload',
    version: '2.6.5', 
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
                // Compteur spécifique à cette source
                const sourceQualityCounts = {};

                for (const stream of response.data.streams) {
                    const rawTitle = stream.title || '';
                    const info = getQualityInfo(rawTitle);
                    
                    // On définit l'identifiant de qualité (ex: 4K, 1080P)
                    const qTag = info.quality.split(':')[1].toUpperCase();
                    
                    // --- LIMITATION PAR SOURCE ET PAR QUALITÉ ---
                    sourceQualityCounts[qTag] = (sourceQualityCounts[qTag] || 0) + 1;
                    if (sourceQualityCounts[qTag] > 5) continue; 
                    // ---------------------------------------------

                    const size = getFileSize(rawTitle);
                    const seedsCount = getSeeders(rawTitle);
                    const peerSite = getPeerSite(rawTitle || stream.name || '');
                    
                    let infoHash = stream.infoHash || '';
                    if (!infoHash && stream.url?.startsWith('magnet:')) {
                        const match = stream.url.match(/btih:([a-fA-F0-9]{40})/);
                        if (match) infoHash = match[1];
                    }
                    if (!infoHash && !stream.url) continue;

                    const fileName = rawTitle.split('\n')[0] || stream.name || 'Unknown File';

                    sourceStreams.push({
                        name: `${source.name} |  ${qTag}`,
                        title: `${fileName}\n${size} | 👤= ${seedsCount} | 🌐= ${peerSite}\n${info.lang}\n⚙️= ${info.extra || '📦Standard'}`,
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: { notWebReady: true, bingeGroup: `link-dz` }
                    });
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
        
        // Extraction simple des seeders pour le tri final
        const sA = parseInt((a.title.match(/👤=\s*(\d+)/) || [0,0])[1]);
        const sB = parseInt((b.title.match(/👤=\s*(\d+)/) || [0,0])[1]);
        return sB - sA;
    });
    
    const result = { streams: allStreams };
    cache.set(cacheKey, result);
    res.json(result);
});

// --- PAGE D'ACCUEIL / INSTALLATION ---
app.get('/', (req, res) => {
    const manifestUrl = `${req.protocol}://${req.get('host')}/manifest.json`;
    const stremioUrl = manifestUrl.replace('https://', 'stremio://').replace('http://', 'stremio://');

    res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${MANIFEST.name} - Installation</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: white; text-align: center; padding: 50px; }
            .container { max-width: 600px; margin: auto; background: #1e1e1e; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            img { width: 120px; border-radius: 20px; margin-bottom: 20px; }
            h1 { color: #e50914; margin-bottom: 10px; }
            p { color: #bbb; margin-bottom: 30px; }
            .btn { display: inline-block; background: #e50914; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-bottom: 20px; transition: 0.3s; }
            .btn:hover { background: #ff0a16; transform: scale(1.05); }
            .copy-box { background: #2c2c2c; padding: 10px; border-radius: 5px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #444; }
            input { background: transparent; border: none; color: #00d4ff; width: 80%; font-family: monospace; outline: none; }
            button { background: #444; border: none; color: white; padding: 5px 10px; cursor: pointer; border-radius: 3px; }
            button:hover { background: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <img src="${MANIFEST.logo}" alt="Logo">
            <h1>${MANIFEST.name}</h1>
            <p>${MANIFEST.description}</p>
            <a href="${stremioUrl}" class="btn">INSTALLER SUR STREMIO</a>
            <div class="copy-box">
                <input type="text" value="${manifestUrl}" id="manifestLink" readonly>
                <button onclick="copyLink()">Copier</button>
            </div>
            <p style="font-size: 12px; margin-top: 20px;">Version ${MANIFEST.version}</p>
        </div>

        <script>
            function copyLink() {
                var copyText = document.getElementById("manifestLink");
                copyText.select();
                copyText.setSelectionRange(0, 99999);
                document.execCommand("copy");
                alert("Lien copié !");
            }
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Torrent♦️Dz Online`));
