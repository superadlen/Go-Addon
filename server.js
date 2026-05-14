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
    version: '2.6.0', 
    name: 'Torrent♦️Dz',
    description: 'Multi-Sources Rapide - Films & Series By Superadlen DZ',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:', 'kitsu'],
    catalogs: [],
    logo: 'https://i.pinimg.com/736x/25/42/be/2542be2c309b788b081c80d0d734e571.jpg'
};

const SOURCES = [
    { url: 'https://addon.peerflix.mov/language=en|qualityfilter=sd,480p,540p,hdtv,screener,vhs,unknown|sort=seed-desc,quality-desc,size-desc', name: 'Torrent-Dz:1' },
    { url: 'https://filmora-production.up.railway.app', name: 'Torrent-Dz:2' },
    { url: 'https://str.zmb.lat/lite', name: 'Torrent-Dz:3' },
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Torrent-Dz:4' },
    { url: 'https://stremthru.stremio.ru/stremio/torz/eyJpbmRleGVycyI6bnVsbCwic3RvcmVzIjpbeyJjIjoicDJwIiwidCI6IiJ9XSwiZmlsdGVyIjoiRmlsZS5TaXplIFx1MDAzYz0gXCI4IEdCXCIgXHUwMDI2XHUwMDI2IFNlZWRlcnMgXHUwMDNlPSA1MCJ9/', name: 'Torrent-Dz:5' },
    { url: 'https://thepiratebay-plus.strem.fun', name: 'Torrent-Dz:6' },
];

function getFileSize(title) {
    const match = (title || '').match(/(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB))/i);
    return match ? `💾= ${match.toUpperCase()}` : '💾= N/A';
}

function getSeeders(title) {
    const match = (title || '').match(/👤\s*(\d+)/);
    return match ? parseInt(match) : 0;
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
        cs: { flag: '🇨zech', names: ['czech', ' cs ', ' ces '] },
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
        lang = `🎧= ${flags} `;
    } else if (found.length >= 2) {
        const flags = found.map(code => languages[code].flag).join('/');
        lang = `🎧= ${flags} `;
    } else if (t.includes('multi')) {
        lang = '🎧:= 🌍 MULTI ';
    } else if (found.length === 1) {
        const code = found;
        const suffix = code === 'fr' ? ' VF' : (code === 'en' ? ' VO' : '');
        lang = `🎧= ${languages[code].flag}${suffix}`;
    }

    if (t.includes('4320p') || t.includes('8k')) quality = '🪐:8K';
    else if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) quality = '🎬:UHD-4K';
    else if (t.includes('1440p') || t.includes('2k') || t.includes('qhd')) quality = '📺:FHD-2K';
    else if (t.includes('1080p') || t.includes('fhd') || t.includes('fullhd')) quality = '📺:1080p';
    else if (t.includes('900p')) quality = '💻:900p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else if (t.includes('576p')) quality = '📼:576p';
    else if (t.includes('480p')) quality = '📼:480p';
    else if (t.includes('360p')) quality = '📱:360p';
    else if (t.includes('240p')) quality = '📱:240p';
    else if (t.includes('3d')) quality = '👓:3D';
    else if (t.includes('hdrip')) quality = '💿:BluRay';
    else if (t.includes('web-dl')) quality = '📀:WEB-DL';
    else if (t.includes('webrip')) quality = '📡:WEBRip';
    else if (t.includes('dvdrip')) quality = '📡:DVDRip';
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
    if (t.includes('yts') || t.includes('yify') || t.includes('yifi')) extra.push('🪢YTS+');
    if (t.includes('thepiratebay')) extra.push('🪢TPB+');
    if (t.includes('1337x')) extra.push('🪢1337x');
    if (t.includes('rutor')) extra.push('🪢Rutor');
    if (t.includes('Peerflix')) extra.push('🪢Djezzy');
    if (t.includes('rarbg')) extra.push('🪢RARBG');
    

    return { quality, extra: extra.join('|'), lang };
}

// ROUTE AJOUTÉE : Page d'accueil HTML Super Pro pour Stremio et Nuvio
app.get('/', (req, res) => {
    const manifestUrl = 'https://go-addon.onrender.com/manifest.json';
    const stremioUrl = manifestUrl.replace('https://', 'stremio://');

    res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${MANIFEST.name} - Stremio Addon</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #8a2be2;
                --primary-hover: #7315d1;
                --bg: #0b0c10;
                --card-bg: #1f2833;
                --text: #c5c6c7;
                --text-light: #ffffff;
                --accent: #45f3ff;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
            body { background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .container { background: var(--card-bg); max-width: 500px; width: 100%; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); }
            .logo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin-bottom: 20px; border: 3px solid var(--primary); box-shadow: 0 0 15px var(--primary); }
            h1 { color: var(--text-light); font-size: 28px; margin-bottom: 10px; font-weight: 700; }
            .version { display: inline-block; background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
            p { font-size: 14px; line-height: 1.6; margin-bottom: 25px; color: #9fedff; }
            .btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; margin-bottom: 12px; }
            .btn-primary { background: var(--primary); color: white; }
            .btn-primary:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(138, 43, 226, 0.4); }
            .btn-secondary { background: transparent; color: var(--accent); border: 2px solid var(--accent); }
            .btn-secondary:hover { background: var(--accent); color: var(--bg); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(69, 243, 255, 0.3); }
            .input-group { background: #0f141c; border: 1px solid #2c3540; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; margin-top: 20px; }
            .url-text { font-size: 12px; color: #8592a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%; text-align: left; }
            .copy-btn { background: #2c3540; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600; }
            .copy-btn:hover { background: #3d4958; }
            .footer { margin-top: 25px; font-size: 11px; color: #526173; }
            .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(100px); background: #4caf50; color: white; padding: 10px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; transition: transform 0.3s ease; opacity: 0; }
            .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        </style>
    </head>
    <body>
        <div class="container">
            <img class="logo" src="${MANIFEST.logo}" alt="Logo">
            <h1>${MANIFEST.name}</h1>
            <span class="version">v${MANIFEST.version}</span>
            <p>${MANIFEST.description}</p>
            
            <a href="${stremioUrl}" class="btn btn-primary">⚡ Installer sur Stremio</a>
            
            <button onclick="copyManifest()" class="btn btn-secondary">📋 Copier le lien Manifest</button>

            <div class="input-group">
                <span class="url-text" id="manifestUrl">${manifestUrl}</span>
                <button class="copy-btn" onclick="copyManifest()">Copier</button>
            </div>

            <div class="footer">
                Propulsé par Superadlen DZ &copy; 2026. Tous droits réservés.
            </div>
        </div>

        <div id="toast" class="toast">Lien copié avec succès !</div>

        <script>
            function copyManifest() {
                const url = document.getElementById('manifestUrl').innerText;
                navigator.clipboard.writeText(url).then(() => {
                    const toast = document.getElementById('toast');
                    toast.classList.add('show');
                    setTimeout(() => { toast.classList.remove('show'); }, 2000);
                });
            }
        </script>
    </body>
    </html>
    `);
});

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
                        if (match) infoHash = match;
                    }
                    if (!infoHash && !stream.url) continue;

                    sourceStreams.push({
                        name: `${source.name} \n${info.quality.split(':')}`,
                        title: `${size}  |👤= ${seedsCount}\n${info.lang}\n⚙️= ${info.extra || '📦Standard'}`,
                        infoHash: infoHash ? infoHash.toLowerCase() : undefined,
                        url: !infoHash ? stream.url : undefined,
                        behaviorHints: { notWebReady: true, bingeGroup: `link-dz` }
                    });

                    // Limite : 15 par source
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
app.listen(PORT, () => console.log(`⚡ Link-Dz v2.5.0 Online`));
