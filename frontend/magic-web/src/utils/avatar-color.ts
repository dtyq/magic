/**
 * Maps a display name to a stable accent color for letter avatars.
 * Uses inline styles so Tailwind JIT does not need to scan dynamic class names.
 */

const PALETTE: { bg: string; text: string }[] = [
	{ bg: "#8b5cf6", text: "#ffffff" },
	{ bg: "#0ea5e9", text: "#ffffff" },
	{ bg: "#10b981", text: "#ffffff" },
	{ bg: "#f97316", text: "#ffffff" },
	{ bg: "#f43f5e", text: "#ffffff" },
	{ bg: "#f59e0b", text: "#ffffff" },
	{ bg: "#ec4899", text: "#ffffff" },
	{ bg: "#6366f1", text: "#ffffff" },
	{ bg: "#14b8a6", text: "#ffffff" },
	{ bg: "#06b6d4", text: "#ffffff" },
]

/** Deterministic string hash for palette index selection. */
function hashName(name: string): number {
	let hash = 0
	for (let index = 0; index < name.length; index++) {
		hash = (hash * 31 + name.charCodeAt(index)) >>> 0
	}
	return hash
}

/** Returns background and text colors for a name-based avatar placeholder. */
export function getAvatarColor(name: string): { bg: string; text: string } {
	const paletteIndex = hashName(name) % PALETTE.length
	return PALETTE[paletteIndex]
}
