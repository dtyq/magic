/**
 * XGPlayer modules loaded on demand
 */
export interface XGPlayerModules {
	Player: typeof import("xgplayer").default
	MusicPreset: typeof import("xgplayer-music").default
}

/**
 * Load XGPlayer modules on demand
 */
export const loadXGPlayer = async (): Promise<XGPlayerModules["Player"]> => {
	const xgplayer = await import("xgplayer")
	return xgplayer.default
}

/**
 * Load XGPlayer Music preset on demand
 */
export const loadXGPlayerMusic = async (): Promise<XGPlayerModules["MusicPreset"]> => {
	const xgplayerMusic = await import("xgplayer-music")
	return xgplayerMusic.default
}

/**
 * Load all XGPlayer modules on demand
 */
export const loadXGPlayerModules = async (): Promise<XGPlayerModules> => {
	const [xgplayer, xgplayerMusic] = await Promise.all([
		import("xgplayer"),
		import("xgplayer-music"),
	])

	return {
		Player: xgplayer.default,
		MusicPreset: xgplayerMusic.default,
	}
}
