function getQualityInfo(title) {
    const t = (title || '').toLowerCase();
    let quality = '';
    let extra = [];
    let lang = '🎧= ❓🔉';

    const languages = {
        fr: { flag: '🇫🇷', names: ['french', ' vf ', ' vff ', 'francais'] },
        en: { flag: '🇺🇸', names: ['english', ' en ', ' eng ', 'anglais'] },
        es: { flag: '🇪🇸', names: ['spanish', ' es ', ' spa ', 'espanol'] },
        it: { flag: '🇮🇹', names: ['italian', ' it ', ' ita ', 'italiano'] },
        pt: { flag: '🇵🇹', names: ['portuguese', ' pt ', ' por '] },
        ru: { flag: '🇷🇺', names: ['russian', ' ru ', ' rus '] },
        de: { flag: '🇩🇪', names: ['german', ' de ', ' ger '] },
        ja: { flag: '🇯🇵', names: ['japanese', ' ja ', ' jpn '] },
        zh: { flag: '🇨🇳', names: ['chinese', ' zh ', ' chi '] },
        ko: { flag: '🇰🇷', names: ['korean', ' ko ', ' kor '] },
        ar: { flag: '🇩🇿', names: ['arabic', ' ar ', ' ara '] }
    };

    const found = Object.entries(languages)
        .filter(([code, data]) =>
            t.includes(code) || data.names.some(n => t.includes(n))
        )
        .map(([code]) => code);

    if (found.length >= 2) {
        lang = `🎧= ${found.map(c => languages[c].flag).join('/')}`;
    } else if (found.length === 1) {
        lang = `🎧= ${languages[found[0]].flag}`;
    }

    // QUALITY
    if (t.includes('2160p') || t.includes('4k')) quality = '🎬:4K';
    else if (t.includes('1080p')) quality = '📺:1080p';
    else if (t.includes('720p')) quality = '🖥️:720p';
    else if (t.includes('webrip')) quality = '🌍:WEBRip';
    else if (t.includes('web-dl') || t.includes('webdl')) quality = '🌐:WEB-DL';
    else if (t.includes('hdrip')) quality = '🎞️:HDRip';
    else if (t.includes('dvdrip')) quality = '📼:DVDRip';
    else quality = '🎥:HD';

    // --- EXTRA INFO CLEAN (OPTIMISÉ) ---
    if (t.includes('bluray') || t.includes('bdrip')) extra.push('💿BluRay');
    if (t.includes('remux')) extra.push('📀REMUX');

    if (t.includes('web-dl') || t.includes('webdl')) extra.push('🌐WEB-DL');
    else if (t.includes('webrip')) extra.push('🌍WEBRip');

    if (t.includes('dvdrip')) extra.push('📼DVDRip');
    if (t.includes('hdrip')) extra.push('🎞️HDRip');

    if (t.includes('uhd')) extra.push('🖥️UHD');
    if (t.includes('3d')) extra.push('🔅3D');
    if (t.includes('amzn')) extra.push('🛒AMZN');

    // codecs
    if (t.includes('hevc') || t.includes('x265') || t.includes('h265')) extra.push('HEVC');
    else if (t.includes('x264')) extra.push('X264');

    if (t.includes('10bit')) extra.push('🎨10BIT');

    // HDR LOGIC CLEAN
    if (t.includes('hdr10')) extra.push('💯HDR10');
    else if (t.includes('dolby vision') || t.includes(' dv ') || t.includes('.dv.')) extra.push('🌈DV');
    else if (t.includes('hdr')) extra.push('✨HDR');

    // audio
    if (t.includes('atmos')) extra.push('🎧ATMOS');
    if (t.includes('truehd')) extra.push('🎵TRUEHD');
    else if (t.includes('ddp5') || t.includes('ddp5.1')) extra.push('🔊DDP5.1');
    else if (t.includes('dts')) extra.push('🔊DTS');
    else if (t.includes('aac')) extra.push('🔉AAC');

    // subtitles / dual
    if (t.includes('dual audio')) extra.push('🎚️DUAL');
    if (t.includes('sub') || t.includes('subs') || t.includes('subtitle')) extra.push('💬SUB');

    // release flags
    if (t.includes('proper')) extra.push('✅PROPER');
    if (t.includes('repack')) extra.push('♻️REPACK');

    return {
        quality,
        extra: extra.join('|'),
        lang
    };
}
