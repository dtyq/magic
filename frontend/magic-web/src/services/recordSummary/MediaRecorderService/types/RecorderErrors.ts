/**
 * Custom error types for RecorderCore adapter
 * RecorderCore 适配器自定义错误类型
 */

/**
 * Base error class for recorder-related errors
 * 录音器相关错误的基类
 */
export class RecorderError extends Error {
	constructor(message: string, public readonly code: string, public readonly cause?: Error) {
		super(message)
		this.name = "RecorderError"

		// Maintain proper stack trace for where error was thrown
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}
}

/**
 * Error thrown when user denies microphone/screen permission
 * 用户拒绝麦克风/屏幕权限时抛出
 */
export class PermissionDeniedError extends RecorderError {
	constructor(message: string, cause?: Error) {
		super(message, "PERMISSION_DENIED", cause)
		this.name = "PermissionDeniedError"
	}
}

/**
 * Error thrown when requested audio source is not supported
 * 请求的音频源不支持时抛出
 */
export class AudioSourceNotSupportedError extends RecorderError {
	constructor(public readonly source: string, message?: string, cause?: Error) {
		super(
			message || `Audio source "${source}" is not supported in this browser`,
			"SOURCE_NOT_SUPPORTED",
			cause,
		)
		this.name = "AudioSourceNotSupportedError"
	}
}

/**
 * Error thrown when recorder initialization fails
 * 录音器初始化失败时抛出
 */
export class RecorderInitializationError extends RecorderError {
	constructor(message: string, cause?: Error) {
		super(message, "INITIALIZATION_FAILED", cause)
		this.name = "RecorderInitializationError"
	}
}

/**
 * Error thrown when audio stream capture fails
 * 音频流捕获失败时抛出
 */
export class AudioStreamCaptureError extends RecorderError {
	constructor(message: string, cause?: Error) {
		super(message, "STREAM_CAPTURE_FAILED", cause)
		this.name = "AudioStreamCaptureError"
	}
}

/**
 * Error thrown when audio encoding fails
 * 音频编码失败时抛出
 */
export class AudioEncodingError extends RecorderError {
	constructor(message: string, cause?: Error) {
		super(message, "ENCODING_FAILED", cause)
		this.name = "AudioEncodingError"
	}
}

/**
 * Error thrown when buffer operations fail
 * 缓冲区操作失败时抛出
 */
export class BufferOperationError extends RecorderError {
	constructor(message: string, cause?: Error) {
		super(message, "BUFFER_OPERATION_FAILED", cause)
		this.name = "BufferOperationError"
	}
}

/**
 * Error thrown when retry attempts are exhausted
 * 重试次数耗尽时抛出
 */
export class RetryExhaustedError extends RecorderError {
	constructor(public readonly attempts: number, message: string, cause?: Error) {
		super(message, "RETRY_EXHAUSTED", cause)
		this.name = "RetryExhaustedError"
	}
}

/**
 * Error thrown when invalid state transition is attempted
 * 尝试无效的状态转换时抛出
 */
export class InvalidStateError extends RecorderError {
	constructor(
		public readonly currentState: string,
		public readonly attemptedAction: string,
		cause?: Error,
	) {
		super(
			`Cannot perform "${attemptedAction}" in state "${currentState}"`,
			"INVALID_STATE",
			cause,
		)
		this.name = "InvalidStateError"
	}
}

/**
 * Error thrown when audio source switching fails
 * 音频源切换失败时抛出
 */
export class AudioSourceSwitchError extends RecorderError {
	constructor(
		public readonly fromSource: string,
		public readonly toSource: string,
		message?: string,
		cause?: Error,
		public readonly recoveredSuccessfully: boolean = false,
	) {
		super(
			message || `Failed to switch audio source from "${fromSource}" to "${toSource}"`,
			"AUDIO_SOURCE_SWITCH_FAILED",
			cause,
		)
		this.name = "AudioSourceSwitchError"
	}
}
