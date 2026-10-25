import type { StyleFeature, StyleLayout } from "../styleProfiles"

export interface CoverContext {
	layout: StyleLayout
	features: StyleFeature[]
	radius: number
}

export function hasFeature(features: StyleFeature[], feature: StyleFeature) {
	return features.includes(feature)
}
