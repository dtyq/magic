import { lazy } from "react"
import type { ComponentType } from "react"
import type { PlatformComponentProps } from "../types"
import type { SelfMediaPlatform } from "../../../types"

type LazyPlatform = ComponentType<PlatformComponentProps>

/** Lazy registry of supported platforms. Add new entries to expand. */
export const platformRegistry: Partial<Record<SelfMediaPlatform, LazyPlatform>> = {
	rednote: lazy(() => import("./rednote")),
	instagram: lazy(() => import("./instagram")),
	"wechat-official-accounts": lazy(() => import("./wechat-official-accounts")),
}

export function getPlatformComponent(
	platform: SelfMediaPlatform | null | undefined,
): LazyPlatform | null {
	if (!platform) return null
	return platformRegistry[platform] || null
}
