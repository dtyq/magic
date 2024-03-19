/**
 * Slide Bridge - Communication layer between slide iframes and parent presentation
 *
 * ========================================================================
 * CRITICAL: Iframe ↔ Parent Communication Protocol
 * ========================================================================
 *
 * This script runs INSIDE each slide iframe and enables communication with
 * the parent presentation window. It solves the cross-frame navigation problem.
 *
 * KEY ARCHITECTURAL CONSTRAINTS:
 * - Iframes cannot directly control parent window navigation
 * - postMessage can only send serializable data (no Event objects)
 * - Must extract only essential event properties for forwarding
 * - Parent window must handle both real events AND forwarded data objects
 *
 * COMMUNICATION FLOW:
 * 1. User presses key inside iframe → this script captures it
 * 2. Extract key properties (key, shiftKey) into plain object
 * 3. Send via postMessage to parent window
 * 4. Parent receives plain object, feeds to unified handleKeyDown()
 * 5. Parent executes slide navigation
 *
 * Features:
 * - Forwards keyboard navigation to parent
 * - Reports slide dimensions for responsive layout
 * - Syncs title changes with parent window
 * - Monitors content changes automatically
 *
 * DO NOT MODIFY the communication protocol without updating parent window!
 * ========================================================================
 */

// Prevent duplicate initialization if script loads multiple times
window.slideBridgeLoaded = true;

// Configuration
// 包含所有常见的演示文稿导航按键，特别支持各种翻页笔设备
// Includes all common presentation navigation keys, especially for various presentation remote devices
const NAVIGATION_KEYS = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',  // 方向键 / Arrow keys
    ' ',                                                  // 空格键 / Space
    'PageUp', 'PageDown',                                // 翻页键（翻页笔最常用）/ Page keys (most common for remotes)
    'Home', 'End',                                       // 首尾页 / First/Last page
    'b', 'B', 'n', 'N',                                  // Back/Next（部分翻页笔）/ Back/Next (some remotes)
    'p', 'P',                                            // Previous（部分翻页笔）/ Previous (some remotes)
    'F11', '?', 'Escape'                                 // 功能键 / Function keys
];
const MIN_DIMENSIONS = { width: 320, height: 240 };
const MAX_DIMENSIONS = { width: 4000, height: 3000 };
const FALLBACK_DIMENSIONS = { width: 1920, height: 1080 };

// ========================================================================
// Communication
// ========================================================================

function sendToParent(type, data = {}) {
    parent.postMessage({ type, ...data }, '*');
}

function handleParentMessage(event) {
    const { type } = event.data;

    if (type === 'pauseMedia') {
        pauseAllMedia();
    } else if (type === 'resumeMedia') {
        resumeAllMedia();
    }
}

function pauseAllMedia() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => {
        if (!media.paused && !media.ended) {
            media.pause();
            // Mark as paused by system so we can resume it later
            media.dataset.sysPaused = 'true';
        }
    });
}

function resumeAllMedia() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => {
        if (media.dataset.sysPaused === 'true') {
            const playPromise = media.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Auto-resume prevented:', error);
                });
            }
            // Clear the flag
            delete media.dataset.sysPaused;
        }
    });
}

function forwardKeyboardEvent(event) {
    if (NAVIGATION_KEYS.includes(event.key)) {
        // 在 Windows 上，必须先阻止默认行为
        // On Windows, must prevent default first
        event.preventDefault();
        event.stopPropagation();

        // ========================================================================
        // CRITICAL: Iframe to Parent Communication
        // ========================================================================
        // IMPORTANT: We can only send serializable data via postMessage
        // Real Event objects cannot be cloned/transferred between windows
        //
        // We extract only the essential properties needed for navigation:
        // - key: The keyboard key pressed
        // - shiftKey: Whether Shift modifier was held
        //
        // DO NOT attempt to send the entire 'event' object - it will fail!
        // The parent window's handleKeyDown() function is designed to handle
        // both real events AND these plain data objects.
        // ========================================================================
        
        // 发送消息到父窗口
        // Send message to parent window
        sendToParent('keydown', {
            key: event.key,
            shiftKey: event.shiftKey
        });
        
        return false;
    }
}

function reportTitle() {
    sendToParent('titleUpdate', { title: document.title });
}

// ========================================================================
// Dimension Detection
// ========================================================================

function getCustomDimensions() {
    const container = document.querySelector('.slide-container');
    if (!container) return null;

    const width = parseInt(container.getAttribute('data-width'), 10);
    const height = parseInt(container.getAttribute('data-height'), 10);

    // Validate custom dimensions
    if (width >= 800 && width <= MAX_DIMENSIONS.width &&
        height >= 600 && height <= MAX_DIMENSIONS.height) {
        const aspectRatio = width / height;
        if (aspectRatio >= 1.0 && aspectRatio <= 2.5) {
            return { width, height, aspectRatio };
        }
    }

    return null;
}

function measureElementDimensions(element) {
    const rect = element.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);

    // Include padding and borders
    if (element.offsetWidth && element.offsetHeight) {
        width = Math.max(width, element.offsetWidth);
        height = Math.max(height, element.offsetHeight);
    }

    // Handle content overflow (unless overflow is hidden)
    const style = window.getComputedStyle(element);
    const isOverflowXHidden = style.overflowX === 'hidden' || style.overflow === 'hidden';
    const isOverflowYHidden = style.overflowY === 'hidden' || style.overflow === 'hidden';

    if (element.scrollWidth && element.scrollHeight) {
        if (!isOverflowXHidden && element.scrollWidth > width) width = element.scrollWidth;
        if (!isOverflowYHidden && element.scrollHeight > height) height = element.scrollHeight;
    }

    return { width, height };
}

function getViewportDimensions() {
    return {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight
    };
}

function calculateDimensions() {
    // Try custom dimensions first
    const customDims = getCustomDimensions();
    if (customDims) return customDims;

    // Measure actual content
    const container = document.querySelector('.slide-container') || document.body;
    let { width, height } = measureElementDimensions(container);

    // Apply minimum constraints
    if (width < MIN_DIMENSIONS.width || height < MIN_DIMENSIONS.height) {
        const viewport = getViewportDimensions();

        if (viewport.width && viewport.height) {
            width = Math.max(width, Math.min(viewport.width, FALLBACK_DIMENSIONS.width));
            height = Math.max(height, Math.min(viewport.height, FALLBACK_DIMENSIONS.height));
        } else {
            width = Math.max(width, FALLBACK_DIMENSIONS.width);
            height = Math.max(height, FALLBACK_DIMENSIONS.height);
        }
    }

    // Apply maximum constraints
    width = Math.min(width, MAX_DIMENSIONS.width);
    height = Math.min(height, MAX_DIMENSIONS.height);

    return {
        width,
        height,
        aspectRatio: width / height
    };
}

async function waitForRender() {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

async function reportDimensions() {
    await waitForRender();
    const dimensions = calculateDimensions();
    sendToParent('dimensionsUpdate', dimensions);
}

// ========================================================================
// Debounced Updates
// ========================================================================

let dimensionUpdateId = null;

function scheduleDimensionUpdate() {
    if (dimensionUpdateId) {
        cancelAnimationFrame(dimensionUpdateId);
    }

    dimensionUpdateId = requestAnimationFrame(async () => {
        await reportDimensions();
        dimensionUpdateId = null;
    });
}

// ========================================================================
// Event Setup
// ========================================================================

function setupKeyboardForwarding() {
    // 使用捕获阶段监听，确保在 Windows 上也能正确捕获
    // Use capture phase to ensure proper capture on Windows
    window.addEventListener('keydown', forwardKeyboardEvent, true);
}

function setupMessageListener() {
    window.addEventListener('message', handleParentMessage);
}

function setupTitleSync() {
    // Monitor title element changes
    const titleElement = document.querySelector('title') || document.head;
    new MutationObserver(reportTitle).observe(titleElement, {
        childList: true,
        subtree: true
    });
}

function setupDimensionMonitoring() {
    const resizeObserver = new ResizeObserver(scheduleDimensionUpdate);

    // Observe key elements for size changes
    const container = document.querySelector('.slide-container');
    if (container) {
        resizeObserver.observe(container);
    }

    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);
}

function setupLoadEvents() {
    // Initial sync on full page load
    window.addEventListener('load', async () => {
        reportTitle();
        await reportDimensions();
    });

    // Early sync when DOM is ready
    document.addEventListener('DOMContentLoaded', reportDimensions);
}

// ========================================================================
// Initialization
// ========================================================================

function initialize() {
    setupKeyboardForwarding();
    setupMessageListener();
    setupTitleSync();
    setupDimensionMonitoring();
    setupLoadEvents();
}

// ========================================================================
// Initialization
// ========================================================================
// Start initialization based on document state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
