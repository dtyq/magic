/**
 * Simple hash function to generate consistent colors from strings
 * Ensures same input always produces the same output
 */
export function generateColorFromString(str: string): string {
	if (!str) return "#6B7280"

	// Simple hash algorithm
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32bit integer
	}

	const normalizedHash = Math.abs(hash)
	const goldenRatioConjugate = 0.61803398875
	const hue = Math.floor(((normalizedHash * goldenRatioConjugate) % 1) * 360)
	const saturation = 68 + (normalizedHash % 22) // 68-89%
	const lightness = 52 + (normalizedHash % 10) // 52-61%

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function getFileColor(filetype?: string): string {
	if (!filetype) return ""

	// Colors extracted from Figma design specification
	const commonTypes: Record<string, string> = {
		// Document types
		pdf: "#DC2626",
		doc: "#2563EB",
		docx: "#2563EB",
		word: "#2563EB",
		ppt: "#EA580C",
		pptx: "#EA580C",
		xls: "#059669",
		xlsx: "#059669",
		excel: "#059669",
		// Text and markup
		txt: "#FB923C",
		md: "#64748B",
		markdown: "#64748B",
		// Programming languages
		js: "#EAB308",
		javascript: "#EAB308",
		ts: "#EAB308",
		typescript: "#EAB308",
		jsx: "#EAB308",
		tsx: "#EAB308",
		css: "#1D4ED8",
		scss: "#1D4ED8",
		sass: "#1D4ED8",
		less: "#1D4ED8",
		html: "#2563EB",
		htm: "#2563EB",
		xml: "#16A34A",
		json: "#EC4899",
		yaml: "#EC4899",
		yml: "#EC4899",
		// Backend languages
		py: "#3B82F6",
		python: "#3B82F6",
		java: "#0891B2",
		php: "#7C3AED",
		go: "#059669",
		c: "#6B7280",
		cpp: "#6B7280",
		cc: "#6B7280",
		cxx: "#6B7280",
		cs: "#7C3AED",
		rb: "#DC2626",
		ruby: "#DC2626",
		rs: "#DC2626",
		rust: "#DC2626",
		// Shell and scripts
		sh: "#6B7280",
		bash: "#6B7280",
		zsh: "#6B7280",
		fish: "#6B7280",
		bat: "#6B7280",
		cmd: "#6B7280",
		// Archives and compression
		zip: "#EAB308",
		rar: "#EAB308",
		tar: "#EAB308",
		gz: "#EAB308",
		"7z": "#EAB308",
		// Media files
		jpg: "#F97316",
		jpeg: "#F97316",
		png: "#F97316",
		gif: "#F97316",
		svg: "#F97316",
		webp: "#F97316",
		bmp: "#F97316",
		ico: "#F97316",
		image: "#F97316",
		// Video files
		mp4: "#8B5CF6",
		avi: "#8B5CF6",
		mov: "#8B5CF6",
		mkv: "#8B5CF6",
		webm: "#8B5CF6",
		video: "#8B5CF6",
		// Audio files
		mp3: "#F97316",
		wav: "#F97316",
		flac: "#F97316",
		aac: "#F97316",
		ogg: "#F97316",
		audio: "#F97316",
		// Special file types
		folder: "#F59E0B",
		directory: "#F59E0B",
		link: "#0EA5E9",
		url: "#0EA5E9",
		// Magic platform specific
		magicdoc: "#64748B",
		magictable: "#10B981",
		whiteboard: "#8B5CF6",
		mindmap: "#EF4444",
		xmind: "#DC2626",
		// Database
		sql: "#4383ea",
		mysql: "#4383ea",
		sqlite: "#4383ea",
		db: "#4383ea",
		// Others
		other: "#6B7280",
		unknown: "#6B7280",
		// Legacy/old formats
		olddoc: "#06B6D4",
		// Shared content
		sharefolder: "#3B82F6",
		// Wiki
		wiki: "#10B981",
		// Meeting/report types
		meeting: "#2563EB",
		report: "#1D4ED8",
		dashboard: "#3B82F6",
		slides: "#EA580C",
	}

	return commonTypes[filetype]
}
