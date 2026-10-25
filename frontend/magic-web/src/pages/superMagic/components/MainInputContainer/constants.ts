export const AGENT_INPUT_CONTAINER_HEADER_ID = "agent-input-container-header" as const

export const SLIDES_TEMPLATE_RANDOM_DRAG_TYPE =
	"application/x-magic-slides-template-random" as const
export const SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT =
	"magic:slides-template-random-drag-start" as const
export const SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT =
	"magic:slides-template-random-drag-end" as const

export function hasSlidesTemplateRandomDragType(dataTransfer: Pick<DataTransfer, "types">) {
	return Array.from(dataTransfer.types).includes(SLIDES_TEMPLATE_RANDOM_DRAG_TYPE)
}

/**
 * Scene input container IDs
 */
export const SCENE_INPUT_IDS = {
	INPUT_CONTAINER: "input-container" as const,
	SCENES_SWITCHER: "scenes-switcher" as const,
	TASK_DATA_NODE: "task-data-node" as const,
}

/**
 * Scene input container min height (prevent layout shift)
 */
export const INPUT_CONTAINER_MIN_HEIGHT = {
	HomePage: 170,
	TopicPage: 120,
	InvalidModeFallback: 96,
	MobilePage: 132,
}

/**
 * Scene config area min height to keep centered layout stable
 */
export const SCENE_PANEL_MIN_HEIGHT = {
	HomePage: 204,
}

/**
 * Scene switch animation configuration (subtle)
 * Light scale + opacity transition for scene switching
 */
export const SCENE_ANIMATION_CONFIG = {
	initial: {
		opacity: 1,
		scale: 1,
	},
	animate: {
		opacity: 1,
		scale: 1,
	},
	exit: {
		opacity: 1,
		scale: 1,
	},
	transition: {
		duration: 0.15,
		ease: [0.4, 0, 0.2, 1],
	},
} as const
