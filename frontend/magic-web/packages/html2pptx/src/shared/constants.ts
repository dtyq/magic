/** Pixel-to-point ratio (1px = 0.75pt) */
export const PX_TO_PT_RATIO = 0.75
/** Default DPI */
export const DEFAULT_DPI = 96
/** Horizontal safety margin for text boxes in px */
export const TEXT_SAFETY_MARGIN_X = 4
/** Vertical safety margin for text boxes in px */
export const TEXT_SAFETY_MARGIN_Y = 2

/** Line-height threshold for single-line text as a multiplier */
export const LINE_HEIGHT_THRESHOLD = 1.5

/** Threshold for deciding whether wrapping is needed as a multiplier */
export const WRAP_THRESHOLD = 1.15

// Render-stage timing parameters in milliseconds:
// - RENDER_TIMEOUT_MS: hard timeout for the whole render
// - READY_STATE_FALLBACK_MS: fallback wait when readyState stays incomplete for too long
// - READY_STATE_POLL_MS: interval for polling document readiness
// - NATIVE_LOAD_WAIT_MS: fallback window for executable/resource-bearing pages;
//   static pages may bypass it after the document reaches readyState=complete
// - EXTERNAL_RESOURCE_TIMEOUT_MS: window for waiting for external script/style resources to settle
// When tuning, adjust the fallback and overall timeout first, then fine-tune polling parameters.
export const RENDER_TIMEOUT_MS = 30000
export const READY_STATE_FALLBACK_MS = 6000
export const READY_STATE_POLL_MS = 50
export const NATIVE_LOAD_WAIT_MS = 1500
export const EXTERNAL_RESOURCE_TIMEOUT_MS = 30000
/** Idle window after external script/style resources settle */
export const DEFAULT_EXTERNAL_RESOURCE_IDLE_MS = 500
/** Load timeout for one static resource (script/style/img/video) */
export const RESOURCE_LOAD_TIMEOUT_MS = 50000
/** Maximum retries after a static resource load timeout; skip the resource after this limit */
export const RESOURCE_MAX_RETRIES = 3
/** Extra wait time for pages with canvas to finish drawing */
export const CANVAS_DELAY_MS = 2000

/** Absolute image pixel limit: larger images add no visible PPT/HTML benefit but can explode memory usage */
export const IMAGE_ABSOLUTE_MAX_DIMENSION = 2560
/** Image pixel limit for low-memory devices (<=4 GB) */
export const IMAGE_LOW_MEM_MAX_DIMENSION = 1024

/** Supersampling factor for pseudo-element icon rendering to improve sharpness */
export const ICON_SCALE_FACTOR = 4

/** Floating-point tolerance for page slicing to avoid false extra pages at boundaries */
export const SLICE_EPSILON = 1e-6
