/**
 * Dependency injection interfaces for audio recorder adapter
 * 音频录制器适配器依赖注入接口
 */

/**
 * Media devices interface for dependency injection
 * 用于依赖注入的媒体设备接口
 */
export interface MediaDevicesInterface {
	getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
	getDisplayMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
}

/**
 * Audio context factory interface
 * 音频上下文工厂接口
 */
export interface AudioContextFactory {
	create(options?: AudioContextOptions): AudioContext
}

/**
 * Logger interface for dependency injection
 * 用于依赖注入的日志接口
 */
export interface LoggerInterface {
	log(message: string, ...args: unknown[]): void
	warn(message: string, ...args: unknown[]): void
	error(message: string, ...args: unknown[]): void
	report(data: { namespace: string; data: Record<string, unknown> }): void
}

/**
 * All dependencies required by audio recorder adapter
 * 音频录制器适配器所需的所有依赖
 */
export interface RecorderDependencies {
	mediaDevices: MediaDevicesInterface
	audioContextFactory: AudioContextFactory
	logger: LoggerInterface
	workletPath?: string // Custom AudioWorklet file path
	preferWorklet?: boolean // Prefer AudioWorklet over ScriptProcessor (default: true)
	preauthorizedDisplayMedia?: MediaStream | null // Pre-authorized display media from user gesture
}

/**
 * Default implementation of MediaDevicesInterface
 * MediaDevicesInterface 的默认实现
 */
export class DefaultMediaDevices implements MediaDevicesInterface {
	async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			throw new Error("getUserMedia is not supported in this browser")
		}
		return navigator.mediaDevices.getUserMedia(constraints)
	}

	async getDisplayMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
			throw new Error("getDisplayMedia is not supported in this browser")
		}
		return navigator.mediaDevices.getDisplayMedia(constraints)
	}
}

/**
 * Default implementation of AudioContextFactory
 * AudioContextFactory 的默认实现
 */
export class DefaultAudioContextFactory implements AudioContextFactory {
	create(options?: AudioContextOptions): AudioContext {
		return new AudioContext(options)
	}
}

/**
 * Create default dependencies using browser APIs
 * 使用浏览器 API 创建默认依赖
 */
export function createDefaultDependencies(logger: LoggerInterface): RecorderDependencies {
	return {
		mediaDevices: new DefaultMediaDevices(),
		audioContextFactory: new DefaultAudioContextFactory(),
		logger,
	}
}
