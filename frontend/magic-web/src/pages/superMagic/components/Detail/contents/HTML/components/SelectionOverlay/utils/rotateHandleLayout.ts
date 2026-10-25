/** Diameter of the circular rotate handle button. */
export const ROTATE_HANDLE_SIZE = 20

/** Stem from the handle to the selection top edge. */
export const ROTATE_HANDLE_CONNECTOR_HEIGHT = 16

/** Extra space for the angle badge above the handle. */
export const ROTATE_ANGLE_INDICATOR_HEIGHT = 24

/**
 * Offset of the rotate-handle wrapper from the selection top.
 * The stem must end at the selection edge, not enter the box.
 */
export const ROTATE_HANDLE_WRAPPER_TOP = -(ROTATE_HANDLE_SIZE + ROTATE_HANDLE_CONNECTOR_HEIGHT)

/** Space reserved above a selection for rotate chrome. */
export const CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE =
	-ROTATE_HANDLE_WRAPPER_TOP + ROTATE_ANGLE_INDICATOR_HEIGHT
