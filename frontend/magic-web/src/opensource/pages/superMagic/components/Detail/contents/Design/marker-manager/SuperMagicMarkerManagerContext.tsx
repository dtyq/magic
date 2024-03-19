import { SuperMagicMarkerManager } from "./SuperMagicMarkerManager"

/** 获取 SuperMagicMarkerManager 单例（静态 Class，无 Provider） */
export function useSuperMagicMarkerManager(): SuperMagicMarkerManager {
	return SuperMagicMarkerManager.getInstance()
}

/** 获取 SuperMagicMarkerManager 单例（兼容旧调用方，单例模式下与 useSuperMagicMarkerManager 等价） */
export function useSuperMagicMarkerManagerOptional(): SuperMagicMarkerManager {
	return SuperMagicMarkerManager.getInstance()
}
