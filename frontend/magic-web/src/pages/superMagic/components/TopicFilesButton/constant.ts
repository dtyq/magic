export const FOLDER_INDENT_WIDTH = 10

export const ROOT_FILE_ID = ""

// Preset file types for creating new files
export const PRESET_FILE_TYPES = [
	"txt",
	"md",
	"html",
	"py",
	"go",
	"php",
	"customFile",
	"design",
] as const

export type PresetFileType = (typeof PRESET_FILE_TYPES)[number]
