(() => {
    const order = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
    let preference = 'auto';
    let resetAuto = false;
    const enforceQuality = () => {
        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (!player) return;
        try {
            if (preference === 'auto') {
                if (resetAuto && typeof player.setPlaybackQualityRange === 'function') {
                    player.setPlaybackQualityRange('default', 'default');
                    if (typeof player.setPlaybackQuality === 'function') player.setPlaybackQuality('default');
                    resetAuto = false;
                }
                return;
            }
            if (typeof player.getAvailableQualityLevels !== 'function' || typeof player.setPlaybackQualityRange !== 'function') return;
            const available = player.getAvailableQualityLevels();
            if (!Array.isArray(available)) return;
            const levels = order.filter(level => available.includes(level));
            const target = preference === 'highest' ? levels[0] :
                levels.find(level => order.indexOf(level) >= order.indexOf(preference)) || levels[levels.length - 1];
            if (target) player.setPlaybackQualityRange(target, target);
        } catch (error) {
            // The player may be replaced during navigation or may not support quality control.
        }
    };
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.origin !== window.location.origin || event.data?.action !== 'ytr-update-quality') return;
        const quality = event.data.quality;
        if (!['auto', 'highest', ...order].includes(quality)) return;
        resetAuto = quality === 'auto' && preference !== 'auto';
        preference = quality;
        enforceQuality();
    });
    window.addEventListener('yt-navigate-finish', enforceQuality);
    setInterval(enforceQuality, 2000);
})();
