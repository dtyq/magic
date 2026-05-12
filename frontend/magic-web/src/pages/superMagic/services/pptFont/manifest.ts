import type { PptFontManifest } from "./types"

let manifestPromise: Promise<PptFontManifest> | undefined

export async function loadPptFontManifest(): Promise<PptFontManifest> {
	manifestPromise ??= import("./config/manifest.json").then(
		(module) => module.default as PptFontManifest,
	)
	return manifestPromise
}
