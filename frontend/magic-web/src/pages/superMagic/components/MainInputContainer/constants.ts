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
	HomePage: 150,
	TopicPage: 172,
}

/**
 * Scene switch animation configuration (subtle)
 * Light scale + opacity transition for scene switching
 */
export const SCENE_ANIMATION_CONFIG = {
	initial: {
		opacity: 0.8,
		scale: 0.99,
	},
	animate: {
		opacity: 1,
		scale: 1,
	},
	exit: {
		opacity: 0.6,
		scale: 0.98,
	},
	transition: {
		duration: 0.15,
		ease: [0.4, 0, 0.2, 1],
	},
} as const
