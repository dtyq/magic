export const AGENT_INPUT_CONTAINER_HEADER_ID = "agent-input-container-header" as const

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
	TopicPage: 172,
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
