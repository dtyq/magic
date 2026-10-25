export const MICRO_APP_DISPLAY_TYPES = ["micro-app", "html-app"] as const

export type MicroAppDisplayType = (typeof MICRO_APP_DISPLAY_TYPES)[number]

/** Display types used by HTML app folders in magic.project.js metadata. */
export function isMicroAppDisplayType(type: unknown): type is MicroAppDisplayType {
	return typeof type === "string" && MICRO_APP_DISPLAY_TYPES.includes(type as MicroAppDisplayType)
}
