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
    version: '2.5.7', 
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
    { url: 'https://zamunda-stremio.tzkppv.com/debrid=none|content=all|quality=4k,1080p,720p|lang=en', name: 'Torrent-Dz:4' }
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

    if (found.length >= 5) {
        const flags = found.slice(0, 5).map(code => languages[code].flag).join('/');
        lang = `🎧= ${flags} `;
    } else if (found.length >= 2) {
        const flags = found.map(code => languages[code].flag).join('/');
        lang = `🎧= ${flags} `;
    } else if (t.includes('multi')) {
        lang = '🎧:= 🌍 MULTI ';
    } else if (found.length === 1) {
        const code = found[0];
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
                let qualityCount = {};

                for (const stream of response.data.streams) {
                    const info = getQualityInfo(stream.title || '');
                    
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
                        name: `${source.name} \n${info.quality.split(':')[1]}`,
                        title: `${size}  |👤= ${seedsCount}\n${info.lang}\n⚙️= ${info.extra || '📦Standard'}`,
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

// PAGE D'INSTALLATION POUR STREMIO ET NUVIO
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>Torrent♦️Dz - Addon Stremio</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            border-radius: 32px;
            padding: 30px 25px;
            max-width: 500px;
            width: 100%;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 25px 45px rgba(0,0,0,0.3);
        }

        .logo {
            text-align: center;
            margin-bottom: 20px;
        }

        .logo h1 {
            font-size: 2.2em;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .logo p {
            color: #888;
            font-size: 0.85em;
            margin-top: 5px;
        }

        .manifest-box {
            background: #0a0a0a;
            border-radius: 16px;
            padding: 15px;
            margin: 20px 0;
            border: 1px solid #333;
        }

        .manifest-label {
            color: #4ecdc4;
            font-size: 0.75em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .manifest-url {
            background: #000;
            padding: 12px;
            border-radius: 12px;
            font-family: 'Courier New', monospace;
            font-size: 0.8em;
            word-break: break-all;
            color: #ff6b6b;
            border: 1px solid #333;
        }

        .btn-copy {
            background: #2c2c3e;
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.7em;
            transition: all 0.2s;
        }

        .btn-copy:hover {
            background: #4ecdc4;
            color: #000;
        }

        .btn {
            display: block;
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 14px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            text-align: center;
            text-decoration: none;
            margin-bottom: 12px;
        }

        .btn-stremio {
            background: linear-gradient(135deg, #6b46c1, #805ad5);
            color: white;
        }

        .btn-stremio:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(107,70,193,0.4);
        }

        .btn-nuvio {
            background: linear-gradient(135deg, #e53e3e, #ed64a6);
            color: white;
        }

        .btn-nuvio:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(229,62,62,0.4);
        }

        .btn-manual {
            background: rgba(255,255,255,0.1);
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
        }

        .btn-manual:hover {
            background: rgba(255,255,255,0.2);
        }

        .info {
            background: rgba(78,205,196,0.1);
            border-left: 3px solid #4ecdc4;
            padding: 12px;
            border-radius: 12px;
            margin: 20px 0;
            font-size: 0.8em;
            color: #ccc;
        }

        .status {
            text-align: center;
            margin-top: 15px;
            font-size: 0.75em;
            color: #4ecdc4;
        }

        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 0.7em;
            color: #555;
        }

        .toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #4ecdc4;
            color: #000;
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 0.85em;
            font-weight: bold;
            transition: transform 0.3s;
            z-index: 1000;
            white-space: nowrap;
        }

        .toast.show {
            transform: translateX(-50%) translateY(0);
        }

        @media (max-width: 480px) {
            .card {
                padding: 20px;
            }
            .logo h1 {
                font-size: 1.6em;
            }
            .manifest-url {
                font-size: 0.65em;
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <h1>🔗 Torrent♦️Dz</h1>
            <p>Multi-Sources Rapide - Films & Series</p>
            <p style="font-size:0.7em;color:#4ecdc4">By Superadlen DZ</p>
        </div>

        <div class="manifest-box">
            <div class="manifest-label">
                <span>📋 LIEN DU MANIFEST</span>
                <button class="btn-copy" onclick="copyManifest()">Copier</button>
            </div>
            <div class="manifest-url" id="manifestUrl">
                chargement...
            </div>
        </div>

        <a href="#" id="stremioLink" class="btn btn-stremio">
            🎬 Installer sur Stremio
        </a>

        <button class="btn btn-nuvio" onclick="installNuvio()">
            📱 Installer sur Nuvio
        </button>

        <button class="btn btn-manual" onclick="copyManifest()">
            📋 Copier le lien manifest
        </button>

        <div class="info">
            💡 <strong>Installation manuelle :</strong><br>
            1. Copiez le lien ci-dessus<br>
            2. Ouvrez Stremio → Modules complémentaires<br>
            3. Collez le lien et installez
        </div>

        <div class="status" id="status">
            ✅ Addon prêt
        </div>

        <div class="footer">
            v2.5.7 | Torrent + DHT Network
        </div>
    </div>

    <div id="toast" class="toast">✅ Copié !</div>

    <script>
        function getBaseUrl() {
            const protocol = window.location.protocol;
            const host = window.location.host;
            return protocol + '//' + host;
        }

        function getManifestUrl() {
            return getBaseUrl() + '/manifest.json';
        }

        function copyManifest() {
            const url = getManifestUrl();
            navigator.clipboard.writeText(url).then(() => {
                showToast('✅ Lien copié !');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = url;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('✅ Lien copié !');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        function installStremio() {
            const manifestUrl = getManifestUrl();
            const stremioUrl = 'stremio://' + manifestUrl.replace(/^https?:\/\//, '') + '/manifest.json';
            window.location.href = stremioUrl;
            
            setTimeout(() => {
                window.location.href = manifestUrl;
            }, 500);
        }

        function installNuvio() {
            const manifestUrl = getManifestUrl();
            const nuvioUrl = 'nuvio://install?addon=' + encodeURIComponent(manifestUrl);
            window.location.href = nuvioUrl;
            
            showToast('🔄 Ouverture de Nuvio...');
            
            setTimeout(() => {
                copyManifest();
            }, 1000);
        }

        document.getElementById('stremioLink').onclick = function(e) {
            e.preventDefault();
            installStremio();
        };

        const manifestUrl = getManifestUrl();
        document.getElementById('manifestUrl').textContent = manifestUrl;
        
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
            document.getElementById('status').innerHTML = '⚠️ HTTPS recommandé pour Stremio';
            document.getElementById('status').style.color = '#f39c12';
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Link-Dz v2.5.0 Online`));
