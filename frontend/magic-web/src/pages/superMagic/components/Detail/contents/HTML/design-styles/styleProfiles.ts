import { STYLE_PROFILES_A_F } from "./style-profiles/profiles-a-f"
import { STYLE_PROFILES_G_M } from "./style-profiles/profiles-g-m"
import { STYLE_PROFILES_N_S } from "./style-profiles/profiles-n-s"
import { STYLE_PROFILES_T_Z } from "./style-profiles/profiles-t-z"

export type {
	LocalizedStyleText,
	StyleFeature,
	StyleLayout,
	StyleProfile,
	StyleScene,
	StyleTheme,
} from "./style-profiles/types"

import type { StyleProfile } from "./style-profiles/types"

export const STYLE_PROFILES = [
	...STYLE_PROFILES_A_F,
	...STYLE_PROFILES_G_M,
	...STYLE_PROFILES_N_S,
	...STYLE_PROFILES_T_Z,
] satisfies StyleProfile[]

const STYLE_PROFILE_BY_CODE = new Map(STYLE_PROFILES.map((profile) => [profile.code, profile]))

export function getStyleProfile(code: string): StyleProfile | undefined {
	return STYLE_PROFILE_BY_CODE.get(code)
}
