import { VoiceToTextService } from "@/opensource/services/voiceToText"

let serviceInstance: VoiceToTextService | null = null

/**
 * Get VoiceToTextService singleton instance
 * 获取 VoiceToTextService 单例实例
 */
export function getVoiceToTextServiceInstance(): VoiceToTextService {
	if (!serviceInstance) {
		serviceInstance = new VoiceToTextService()
	}
	return serviceInstance
}

/**
 * Dispose VoiceToTextService singleton instance
 * 销毁 VoiceToTextService 单例实例
 *
 * This should only be called when the application is shutting down
 * or when a complete reset is needed.
 */
export function disposeVoiceToTextServiceInstance(): void {
	if (serviceInstance) {
		serviceInstance.dispose()
		serviceInstance = null
	}
}

/**
 * Check if singleton instance exists
 * 检查单例实例是否存在
 */
export function hasVoiceToTextServiceInstance(): boolean {
	return serviceInstance !== null
}
