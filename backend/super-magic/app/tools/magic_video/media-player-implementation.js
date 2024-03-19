/**
 * Video 媒体播放器实现
 * 支持多种视频平台：YouTube、Bilibili 等
 * 继承 MediaPlayer 基类，添加 video 特定的功能
 */

/**
 * 视频平台适配器基类
 * 定义统一的接口，由具体平台实现
 */
class VideoPlatformAdapter {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = options;
        this.isReady = false;
        this.player = null;
        this._callbacks = {};
    }

    // 需要子类实现的方法
    async init() { throw new Error('init() must be implemented'); }
    play() { throw new Error('play() must be implemented'); }
    pause() { throw new Error('pause() must be implemented'); }
    seekTo(seconds) { throw new Error('seekTo() must be implemented'); }
    getCurrentTime() { throw new Error('getCurrentTime() must be implemented'); }
    getDuration() { throw new Error('getDuration() must be implemented'); }
    setPlaybackRate(rate) { throw new Error('setPlaybackRate() must be implemented'); }
    getPlaybackRate() { throw new Error('getPlaybackRate() must be implemented'); }
    isPlaying() { throw new Error('isPlaying() must be implemented'); }
    isPaused() { throw new Error('isPaused() must be implemented'); }
    destroy() { throw new Error('destroy() must be implemented'); }

    // 事件管理
    on(event, callback) {
        this._callbacks[event] = callback;
    }

    off(event) {
        delete this._callbacks[event];
    }

    _emit(event, data) {
        if (this._callbacks[event]) {
            this._callbacks[event](data);
        }
    }
}

/**
 * 本地视频平台适配器
 * 使用 HTML5 <video> 元素
 */
class LocalVideoAdapter extends VideoPlatformAdapter {
    constructor(containerId, adapterConfig = {}) {
        super(containerId, adapterConfig);
        this.videoSrc = adapterConfig.videoSrc;
        this.playbackRate = 1;  // 固定为正常速度
        this.progressIntervalId = null;
    }

    /**
     * 初始化本地视频播放器
     */
    async init() {
        return new Promise((resolve, reject) => {
            const container = document.getElementById(this.containerId);
            if (!container) {
                reject(new Error(`Container element ${this.containerId} not found`));
                return;
            }

            if (!this.videoSrc) {
                reject(new Error('Video source is required for local video player'));
                return;
            }

            // 创建 video 元素
            this.player = document.createElement('video');
            this.player.id = `${this.containerId}-video`;
            this.player.controls = true;
            this.player.style.backgroundColor = '#000';
            this.player.src = this.videoSrc;

            // 禁用自动播放
            this.player.autoplay = false;

            // 禁用控制菜单：倍速、下载、画中画
            // 注意：noplaybackrate 只隐藏菜单，不影响脚本控制
            this.player.controlsList = 'noplaybackrate nodownload';
            this.player.disablePictureInPicture = true;

            // 清空容器并添加 video 元素
            container.innerHTML = '';
            container.appendChild(this.player);

            // 设置事件监听
            this.player.addEventListener('loadedmetadata', () => {
                this.isReady = true;
                this.player.playbackRate = this.playbackRate;
                this._startProgressListener();
                this._emit('onReady', {});
                resolve();
            });

            this.player.addEventListener('error', (e) => {
                const error = this.player.error;
                const errorMessage = error ? `Video error: ${error.code} - ${error.message}` : 'Unknown video error';
                this._emit('onError', { error: errorMessage });
                reject(new Error(errorMessage));
            });

            this.player.addEventListener('play', () => {
                this._emit('onStateChange', {
                    state: 1,
                    stateName: 'PLAYING',
                });
            });

            this.player.addEventListener('pause', () => {
                this._emit('onStateChange', {
                    state: 2,
                    stateName: 'PAUSED',
                });
            });

            this.player.addEventListener('ended', () => {
                this._emit('onStateChange', {
                    state: 0,
                    stateName: 'ENDED',
                });
            });

            this.player.addEventListener('ratechange', () => {
                this.playbackRate = this.player.playbackRate;
                this._emit('onPlaybackRateChange', {
                    playbackRate: this.playbackRate,
                });
            });
        });
    }

    /**
     * 启动进度监听器
     */
    _startProgressListener() {
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
        }

        this.progressIntervalId = setInterval(() => {
            if (this.isReady && this.player) {
                try {
                    const currentTime = this.player.currentTime;
                    const duration = this.player.duration;
                    
                    this._emit('onTimeUpdate', {
                        currentTime: currentTime,
                        duration: duration,
                        progress: duration > 0 ? (currentTime / duration) * 100 : 0,
                    });
                } catch (e) {
                    // 忽略错误
                }
            }
        }, 100);
    }

    play() {
        if (this.isReady && this.player) {
            this.player.play().catch(e => {
                console.error('Failed to play video:', e);
            });
        }
    }

    pause() {
        if (this.isReady && this.player) {
            this.player.pause();
        }
    }

    seekTo(seconds) {
        if (this.isReady && this.player) {
            this.player.currentTime = seconds;
        }
    }

    getCurrentTime() {
        if (this.isReady && this.player) {
            return this.player.currentTime;
        }
        return 0;
    }

    getDuration() {
        if (this.isReady && this.player) {
            return this.player.duration;
        }
        return 0;
    }

    setPlaybackRate(rate) {
        // 支持通过脚本设置倍速（菜单已隐藏，但脚本可用）
        if (this.isReady && this.player) {
            this.player.playbackRate = rate;
            this.playbackRate = rate;
        }
    }

    getPlaybackRate() {
        if (this.isReady && this.player) {
            return this.player.playbackRate;
        }
        return this.playbackRate;
    }

    isPlaying() {
        if (this.isReady && this.player) {
            return !this.player.paused && !this.player.ended;
        }
        return false;
    }

    isPaused() {
        if (this.isReady && this.player) {
            return this.player.paused;
        }
        return true;
    }

    destroy() {
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
            this.progressIntervalId = null;
        }

        if (this.player) {
            this.player.pause();
            this.player.src = '';
            this.player.load();
            this.player.remove();
            this.player = null;
            this.isReady = false;
        }
    }
}

/**
 * YouTube 视频平台适配器
 * 使用 YouTube IFrame Player API
 */
class YouTubeAdapter extends VideoPlatformAdapter {
    constructor(containerId, adapterConfig = {}) {
        super(containerId, adapterConfig);
        this.videoId = adapterConfig.videoId;
        this.playerVars = adapterConfig.playerVars || {
            autoplay: 0,
            disablekb: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            fs: 1,
        };
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = adapterConfig.playbackRate || 1;
        this.progressIntervalId = null;
    }

    /**
     * 初始化 YouTube 播放器
     */
    async init() {
        // 等待 YouTube API 加载
        await this._loadYouTubeAPI();

        return new Promise((resolve, reject) => {
            const container = document.getElementById(this.containerId);
            if (!container) {
                reject(new Error(`Container element ${this.containerId} not found`));
                return;
            }

            this.player = new YT.Player(container, {
                videoId: this.videoId,
                playerVars: this.playerVars,
                events: {
                    onReady: (event) => {
                        this.isReady = true;
                        this.duration = this.player.getDuration();
                        this.setPlaybackRate(this.playbackRate);
                        this._startProgressListener();
                        this._emit('onReady', event);
                        resolve();
                    },
                    onStateChange: (event) => {
                        this._handleStateChange(event);
                    },
                    onError: (event) => {
                        this._emit('onError', { error: event.data });
                        reject(new Error(`YouTube player error: ${event.data}`));
                    },
                },
            });
        });
    }

    /**
     * 加载 YouTube IFrame API
     */
    _loadYouTubeAPI() {
        return new Promise((resolve) => {
            if (window.YT && window.YT.Player) {
                resolve();
                return;
            }

            // 如果脚本还未加载，添加脚本
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }

            // 设置全局回调
            window.onYouTubeIframeAPIReady = () => {
                resolve();
            };
        });
    }

    /**
     * 处理播放状态变化
     */
    _handleStateChange(event) {
        const state = event.data;
        const stateMap = {
            [-1]: 'UNSTARTED',
            [0]: 'ENDED',
            [1]: 'PLAYING',
            [2]: 'PAUSED',
            [3]: 'BUFFERING',
            [5]: 'CUED',
        };

        this._emit('onStateChange', {
            state: state,
            stateName: stateMap[state] || 'UNKNOWN',
        });
    }

    /**
     * 启动进度监听器
     */
    _startProgressListener() {
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
        }

        this.progressIntervalId = setInterval(() => {
            if (this.isReady && this.player) {
                try {
                    const currentTime = this.player.getCurrentTime();
                    if (currentTime !== this.currentTime) {
                        this.currentTime = currentTime;
                        this.duration = this.player.getDuration();
                        this._emit('onTimeUpdate', {
                            currentTime: this.currentTime,
                            duration: this.duration,
                            progress: this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0,
                        });
                    }

                    // 监听播放速度变化
                    const currentPlaybackRate = this.player.getPlaybackRate();
                    if (currentPlaybackRate !== this.playbackRate) {
                        this.playbackRate = currentPlaybackRate;
                        this._emit('onPlaybackRateChange', {
                            playbackRate: this.playbackRate,
                        });
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
        }, 100);
    }

    play() {
        if (this.isReady && this.player) {
            this.player.playVideo();
        }
    }

    pause() {
        if (this.isReady && this.player) {
            this.player.pauseVideo();
        }
    }

    seekTo(seconds) {
        if (this.isReady && this.player) {
            this.player.seekTo(seconds, true);
        }
    }

    getCurrentTime() {
        if (this.isReady && this.player) {
            return this.player.getCurrentTime();
        }
        return this.currentTime;
    }

    getDuration() {
        if (this.isReady && this.player) {
            return this.player.getDuration();
        }
        return this.duration;
    }

    setPlaybackRate(rate) {
        if (this.isReady && this.player) {
            this.player.setPlaybackRate(rate);
            this.playbackRate = rate;
        }
    }

    getPlaybackRate() {
        if (this.isReady && this.player) {
            return this.player.getPlaybackRate();
        }
        return this.playbackRate;
    }

    isPlaying() {
        if (this.isReady && this.player && window.YT) {
            return this.player.getPlayerState() === YT.PlayerState.PLAYING;
        }
        return false;
    }

    isPaused() {
        if (this.isReady && this.player && window.YT) {
            return this.player.getPlayerState() === YT.PlayerState.PAUSED;
        }
        return false;
    }

    destroy() {
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
            this.progressIntervalId = null;
        }

        if (this.player) {
            this.player.destroy();
            this.player = null;
            this.isReady = false;
        }
    }
}

/**
 * ConcreteMediaPlayer - Video 实现
 * 继承 MediaPlayer 基类，添加 video 特定的功能
 * 支持多种视频平台
 */
class ConcreteMediaPlayer extends MediaPlayer {
    /**
     * 创建具体媒体播放器实例
     * @param {HTMLElement} mediaElement - 容器元素（用于放置 iframe）
     * @param {Object} options - 配置选项
     * @param {string} options.platform - 视频平台：'youtube' 等
     * @param {Object} options.adapterConfig - 平台适配器的配置（videoId、playerVars、playbackRate 等）
     * @param {Object} options.callbacks - 回调函数集合
     * @param {number} options.metadataDuration - 元数据中的时长
     */
    constructor(mediaElement, options = {}) {
        // 注意：video 场景中，mediaElement 是容器而不是 <video> 元素
        // 创建一个虚拟的 media 元素用于兼容基类
        const dummyMedia = document.createElement('video');
        super(dummyMedia, {
            metadataDuration: options.metadataDuration
        });

        this.container = mediaElement;
        this.platform = options.platform || 'youtube';
        this.adapterConfig = options.adapterConfig || {};
        this.callbacks = options.callbacks || {};
        this.adapter = null;
        this._isPlaying = false;

        // 初始化平台适配器
        this._initAdapter();
    }

    /**
     * 初始化平台适配器
     */
    async _initAdapter() {
        const containerId = this.container.id;

        try {
            // 根据平台创建对应的适配器
            if (this.platform === 'youtube') {
                this.adapter = new YouTubeAdapter(containerId, this.adapterConfig);
            } else if (this.platform === 'local') {
                this.adapter = new LocalVideoAdapter(containerId, this.adapterConfig);
            } else {
                throw new Error(`Unsupported platform: ${this.platform}`);
            }

            // 设置适配器事件监听
            this._setupAdapterEvents();

            // 初始化适配器
            await this.adapter.init();

            // 触发元数据加载完成回调
            if (this.callbacks.onMetadataLoaded) {
                this.callbacks.onMetadataLoaded();
            }
        } catch (error) {
            console.error('Failed to initialize video adapter:', error);
            if (this.callbacks.onMetadataLoadTimeout) {
                this.callbacks.onMetadataLoadTimeout();
            }
        }
    }

    /**
     * 设置适配器事件监听
     */
    _setupAdapterEvents() {
        if (!this.adapter) return;

        // 时间更新
        this.adapter.on('onTimeUpdate', (data) => {
            if (this.callbacks.onTimeUpdate) {
                this.callbacks.onTimeUpdate(data.currentTime);
            }
        });

        // 播放状态变化
        this.adapter.on('onStateChange', (data) => {
            const isPlaying = data.stateName === 'PLAYING';
            const wasPaused = data.stateName === 'PAUSED';
            const wasEnded = data.stateName === 'ENDED';

            if (isPlaying !== this._isPlaying) {
                this._isPlaying = isPlaying;
                if (this.callbacks.onPlayStateChange) {
                    this.callbacks.onPlayStateChange(isPlaying);
                }
            }

            if (wasEnded && this.callbacks.onPlayStateChange) {
                this.callbacks.onPlayStateChange(false);
            }
        });

        // 播放速度变化
        this.adapter.on('onPlaybackRateChange', (data) => {
            if (this.callbacks.onPlaybackRateChange) {
                this.callbacks.onPlaybackRateChange(data.playbackRate);
            }
        });

        // 错误处理
        this.adapter.on('onError', (data) => {
            console.error('Video player error:', data.error);
        });
    }

    /**
     * 播放媒体
     */
    async play() {
        if (this.adapter) {
            this.adapter.play();
        }
    }

    /**
     * 暂停媒体
     */
    pause() {
        if (this.adapter) {
            this.adapter.pause();
        }
    }

    /**
     * 切换播放/暂停状态
     */
    async toggle() {
        if (this.adapter) {
            if (this.adapter.isPlaying()) {
                this.pause();
            } else {
                await this.play();
            }
        }
    }

    /**
     * 跳转到指定时间
     */
    async seekTo(time, options = {}) {
        const { autoplay = false } = options;

        if (this.adapter) {
            this.adapter.seekTo(time);

            if (autoplay) {
                await this.play();
            }
        }
    }

    /**
     * 前进指定秒数
     */
    async forward(seconds) {
        if (this.adapter) {
            const currentTime = this.adapter.getCurrentTime();
            const duration = this.adapter.getDuration();
            const newTime = Math.min(duration, currentTime + seconds);
            const wasPlaying = this.isPlaying;
            await this.seekTo(newTime, { autoplay: wasPlaying });
        }
    }

    /**
     * 后退指定秒数
     */
    async backward(seconds) {
        if (this.adapter) {
            const currentTime = this.adapter.getCurrentTime();
            const newTime = Math.max(0, currentTime - seconds);
            const wasPlaying = this.isPlaying;
            await this.seekTo(newTime, { autoplay: wasPlaying });
        }
    }

    get currentTime() {
        return this.adapter ? this.adapter.getCurrentTime() : 0;
    }

    set currentTime(value) {
        if (this.adapter && typeof value === 'number' && value >= 0) {
            this.adapter.seekTo(value);
        }
    }

    get duration() {
        if (this.metadataDuration && typeof this.metadataDuration === 'number' && this.metadataDuration > 0) {
            return this.metadataDuration;
        }
        return this.adapter ? this.adapter.getDuration() : 0;
    }

    get playbackRate() {
        return this.adapter ? this.adapter.getPlaybackRate() : 1;
    }

    set playbackRate(value) {
        if (this.adapter && typeof value === 'number' && value > 0) {
            this.adapter.setPlaybackRate(value);
        }
    }

    get paused() {
        return this.adapter ? this.adapter.isPaused() : true;
    }

    get isPlaying() {
        return this.adapter ? this.adapter.isPlaying() : false;
    }

    /**
     * 设置媒体源
     * @param {string} mediaSrc - 媒体文件路径（video 场景中不使用）
     */
    setSource(mediaSrc) {
        // Video 场景中，源由 videoId/bvid 等参数指定，不使用 src
        console.warn('setSource() is not used in video platform players');
    }

    /**
     * 获取媒体元素
     * @returns {HTMLElement} 容器元素
     */
    get mediaElement() {
        return this.container;
    }

    /**
     * 销毁播放器
     */
    destroy() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        super.destroy();
    }
}

/**
 * 初始化 video 场景的 PC 端布局
 * 在 PC 端（宽度 > 768px）时，将 player-section 移动到 topics-section 内部的最上方
 */
function initVideoDesktopLayout() {
    const playerSection = document.querySelector('.player-section');
    const topicsSection = document.querySelector('.topics-section');
    const container = document.querySelector('.container');

    if (!playerSection || !topicsSection || !container) {
        console.warn('Video desktop layout: Required elements not found');
        return;
    }

    // 保存原始位置信息
    if (!playerSection._originalParent) {
        playerSection._originalParent = container;
        playerSection._originalNextSibling = playerSection.nextElementSibling;
    }

    /**
     * 根据窗口宽度调整布局
     */
    function adjustLayout() {
        const isDesktop = window.innerWidth > 768;

        if (isDesktop) {
            // PC 端：将 player-section 移动到 topics-section 内部的最上方
            if (playerSection.parentElement !== topicsSection) {
                // 插入到 topics-section 的第一个子元素之前
                topicsSection.insertBefore(playerSection, topicsSection.firstChild);
                
                // 更新 main-content 高度
                updateMainContentHeight();
            }
        } else {
            // 移动端：恢复 player-section 到原始位置（container 的第一个子元素）
            if (playerSection.parentElement !== playerSection._originalParent) {
                playerSection._originalParent.insertBefore(
                    playerSection,
                    playerSection._originalNextSibling
                );
                
                // 更新 main-content 高度
                updateMainContentHeight();
            }
        }
    }

    /**
     * 更新 main-content 高度
     * 在布局切换时需要重新计算高度
     * 复用 audio 模板中定义的全局函数
     */
    function updateMainContentHeight() {
        // 使用 requestAnimationFrame 确保 DOM 更新完成后再计算
        requestAnimationFrame(() => {
            // 调用 audio 模板中定义的全局函数（通过 window 访问）
            if (typeof window.adjustMainContentHeight === 'function') {
                window.adjustMainContentHeight();
            }
            
            if (typeof window.adjustContentPanelHeight === 'function') {
                window.adjustContentPanelHeight();
            }
        });
    }

    // 初始调整
    adjustLayout();

    // 监听窗口大小变化（使用防抖优化性能）
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(adjustLayout, 100);
    });
}

/**
 * 注入 video 场景专用的样式
 * 包括：视频播放器容器样式、移动端布局优化、PC 端布局优化等
 */
function injectVideoStyles() {
    // 检查是否已经注入过
    if (document.getElementById('video-custom-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'video-custom-styles';
    style.textContent = `
        /* 视频播放器容器（用于 video 场景） */
        #media-player {
            aspect-ratio: 16/9;
            background: #000;
            margin-bottom: 12px;
            max-width: 100%;
            height: auto;
        }

        #media-player video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
            max-height: 360px;
        }

        .topics-content {
            flex: 1;
        }

        /* Video 场景：移动端布局优化 */
        @media (max-width: 768px) {
            /* video 场景下，main-content 允许滚动 */
            body[data-media-type="video"] .main-content {
                overflow-y: auto;
                overflow-x: hidden;
            }

            /* video 场景下，topics-section 不限制高度，自动适应内容 */
            body[data-media-type="video"] .topics-section {
                flex: 0 0 auto;
                overflow: visible;
            }

            /* video 场景下，topics-tabs 悬浮固定 */
            body[data-media-type="video"] .topics-tabs {
                position: sticky;
                top: 0;
                z-index: 10;
                background: white;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }

            /* video 场景下，topics-content 不限制高度，不滚动 */
            body[data-media-type="video"] .topics-content {
                flex: 0 0 auto;
                overflow-y: visible;
            }

            /* video 场景下，timeline-section 也不限制高度 */
            body[data-media-type="video"] .timeline-section {
                flex: 0 0 auto;
                overflow: visible;
            }

            /* video 场景下，timeline-tabs 悬浮固定 */
            body[data-media-type="video"] .timeline-tabs {
                position: sticky;
                top: 0;
                z-index: 10;
                background: #fafafa;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
        }

        /* Video 场景：PC 端布局优化 */
        @media (min-width: 769px) {
            /* 当 player-section 在 topics-section 内部时的样式 */
            body[data-media-type="video"] .topics-section > .player-section {
                /* 占据整个宽度 */
                width: 100%;
                margin-bottom: 12px;
                /* 确保在最上方 */
                order: -1;
                /* 减小内边距 */
                padding: 12px 10px 10px 12px;
            }

            /* topics-section 使用 flex 布局，确保 player-section 在最上方 */
            body[data-media-type="video"] .topics-section {
                display: flex;
                flex-direction: column;
                /* 移除背景色，让 player-section 与 tabs/content 在视觉上分开 */
                background: transparent;
                box-shadow: none;
            }

            /* 单独给 topics-tabs 设置背景 */
            body[data-media-type="video"] .topics-tabs {
                background: white;
                border-radius: 8px 8px 0 0;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            /* 单独给 topics-content 设置背景 */
            body[data-media-type="video"] .topics-content {
                background: white;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            /* PC 端 video 场景：播放控制器小尺寸样式 */
            body[data-media-type="video"] .topics-section > .player-section .player-controls {
                gap: 6px;
            }

            /* 播放按钮小尺寸 */
            body[data-media-type="video"] .topics-section > .player-section .play-button {
                width: 32px;
                height: 32px;
                margin-right: 2px;
                flex: none;
            }

            body[data-media-type="video"] .topics-section > .player-section .play-button .material-icons {
                font-size: 18px;
            }

            /* 时间显示小尺寸 */
            body[data-media-type="video"] .topics-section > .player-section .time-display {
                font-size: 12px;
                min-width: 80px;
            }

            /* 速度按钮小尺寸 */
            body[data-media-type="video"] .topics-section > .player-section .speed-controls {
                gap: 3px;
            }

            body[data-media-type="video"] .topics-section > .player-section .speed-button {
                padding: 3px 6px;
                font-size: 10px;
            }

            /* 更多菜单按钮小尺寸 */
            body[data-media-type="video"] .topics-section > .player-section .more-menu-button {
                width: 24px;
                height: 24px;
                font-size: 14px;
            }

            /* 进度条容器小尺寸 */
            body[data-media-type="video"] .topics-section > .player-section .progress-container {
                height: 6px;
                min-width: 0;
            }

            body[data-media-type="video"] .topics-section > .player-section .progress-handle {
                width: 12px;
                height: 12px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * 创建并初始化媒体播放器
 * @param {string} elementId - 容器元素的 ID
 * @param {Object} config - 配置对象（从 magic.project.js 读取）
 * @param {Object} config.metadata - 元数据
 * @param {string} config.metadata.platform - 视频平台：'youtube'、'local' 等（默认 'local'）
 * @param {string} config.metadata.youtube_video_id - YouTube 视频 ID（YouTube 平台必填）
 * @param {number} config.metadata.duration - 视频时长（秒）
 * @param {Object} config.files - 文件配置
 * @param {string} config.files.video - 本地视频文件路径（local 平台必填）
 * @param {Object} callbacks - 回调函数集合
 * @returns {ConcreteMediaPlayer}
 * 
 * 注意：本地视频播放器已隐藏倍速控制菜单，但支持通过脚本设置倍速
 */
function createMediaPlayer(elementId, config, callbacks = {}) {
    const mediaElement = document.getElementById(elementId);
    if (!mediaElement) {
        console.error(`Media element with id "${elementId}" not found`);
        return null;
    }

    // 注入 video 场景专用样式
    injectVideoStyles();

    // 设置 body 的 data-media-type 属性，用于 CSS 选择器
    if (config.type) {
        document.body.setAttribute('data-media-type', config.type);
    }

    // 初始化 PC 端布局（将 player-section 移动到 topics-section 内部）
    // 需要等待 DOM 完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoDesktopLayout);
    } else {
        // DOM 已经加载完成，延迟执行以确保所有元素都已渲染
        setTimeout(initVideoDesktopLayout, 0);
    }

    // 从 config.metadata 中提取平台信息
    const platform = config.metadata?.platform || 'local';
    
    // 构建适配器配置
    let adapterConfig = {};
    
    if (platform === 'youtube') {
        // 从 metadata.youtube_video_id 获取视频 ID
        const videoId = config.metadata?.youtube_video_id;
        if (!videoId) {
            console.error('YouTube platform requires youtube_video_id in metadata');
            return null;
        }
        
        adapterConfig = {
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                disablekb: 1,
                enablejsapi: 1,
                iv_load_policy: 3,
                modestbranding: 1,
                rel: 0,
                fs: 1,
            },
            playbackRate: 1,
        };
    } else if (platform === 'local') {
        // 从 config.files.video 获取本地视频路径
        const videoSrc = config.files?.video;
        if (!videoSrc) {
            console.error('Local platform requires video path in config.files.video');
            return null;
        }
        
        adapterConfig = {
            videoSrc: videoSrc,
        };
    }

    const playerOptions = {
        platform: platform,
        adapterConfig: adapterConfig,
        metadataDuration: config.metadata?.duration,
        callbacks: callbacks,
    };

    const player = new ConcreteMediaPlayer(mediaElement, playerOptions);

    return player;
}
