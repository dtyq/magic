import { getBrowserInfo } from "@/opensource/providers/BrowserProvider/browser"
import { isAndroidMagicApp, isIosMagicApp, isMagicApp } from "@/opensource/utils/devices"

/**
 * 麦克风权限管理服务
 * 统一处理所有麦克风相关的权限逻辑，避免代码重复
 */
export class MicrophonePermissionService {
	/**
	 * 检查麦克风权限状态
	 */
	static async checkPermissionStatus(): Promise<{
		granted: boolean
		canPrompt: boolean
		state: PermissionState | "unsupported"
	}> {
		try {
			if (!navigator.permissions) {
				return { granted: false, canPrompt: true, state: "unsupported" }
			}

			const permission = await navigator.permissions.query({
				name: "microphone" as PermissionName,
			})

			return {
				granted: permission.state === "granted",
				canPrompt: permission.state === "prompt",
				state: permission.state,
			}
		} catch (error) {
			console.warn("Failed to check microphone permission:", error)
			return { granted: false, canPrompt: true, state: "unsupported" }
		}
	}

	/**
	 * 请求麦克风权限并获取 MediaStream
	 * 自动处理约束降级和错误重试
	 */
	static async requestMicrophoneAccess(config?: {
		sampleRate?: number
		channelCount?: number
		echoCancellation?: boolean
		noiseSuppression?: boolean
		autoGainControl?: boolean
	}): Promise<{
		stream: MediaStream
		isFirstTimePermission: boolean
	}> {
		// 检查浏览器支持
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			const error = new Error("当前浏览器不支持录音功能")
			error.name = "NotSupportedError"
			throw error
		}

		// 构造音频约束
		const idealConstraints: MediaStreamConstraints = {
			audio: {
				sampleRate: { ideal: config?.sampleRate || 16000 },
				channelCount: { ideal: config?.channelCount || 1 },
				echoCancellation: config?.echoCancellation ?? true,
				noiseSuppression: config?.noiseSuppression ?? true,
				autoGainControl: config?.autoGainControl ?? true,
			},
		}

		let stream: MediaStream
		let isFirstTimePermission = false

		try {
			// 首次尝试使用完整约束
			console.log("Requesting microphone access with constraints:", idealConstraints)

			// 使用 getUserMedia 的表现来判断是否为首次权限授权
			// 如果权限已经被授权，getUserMedia 会立即返回
			// 如果需要用户确认，会触发浏览器权限弹窗
			const startTime = Date.now()
			stream = await navigator.mediaDevices.getUserMedia(idealConstraints)
			const endTime = Date.now()

			// 如果 getUserMedia 调用耗时较长（超过500ms），说明可能是首次权限授权
			// 但这个判断不够准确，所以我们采用更保守的方式
			// 实际上，在大多数情况下，isFirstTimePermission 应该设为 false
			isFirstTimePermission = false

			console.log("Microphone access granted with full constraints")
		} catch (error) {
			const errorObj = error as Error & { name: string }
			console.log("Microphone access failed:", errorObj.name, errorObj.message)

			// 如果是权限被拒绝，直接抛出，不要尝试简化约束
			if (errorObj.name === "NotAllowedError") {
				console.log("Permission denied, throwing error directly")
				throw error
			}

			// 如果是约束过度或不支持，尝试简化约束
			if (errorObj.name === "OverconstrainedError" || errorObj.name === "NotSupportedError") {
				console.log("Constraint error, trying simplified constraints")
				try {
					stream = await navigator.mediaDevices.getUserMedia({ audio: true })
					isFirstTimePermission = false
					console.log("Microphone access granted with simplified constraints")
				} catch (retryError) {
					console.log("Simplified constraints also failed:", (retryError as Error).name)
					// 直接抛出重试错误，保持原始错误类型
					throw retryError
				}
			} else {
				// 直接抛出原始错误，保持错误类型
				console.log("Other error, throwing directly")
				throw error
			}
		}

		return {
			stream,
			isFirstTimePermission,
		}
	}

	/**
	 * 获取错误的国际化消息
	 */
	static getMicrophoneErrorMessage(
		error: Error & { name: string },
		errorMessages: {
			microphonePermissionDenied: string
			microphoneNotFound: string
			microphoneNotReadable: string
			microphoneOverconstrained: string
			microphoneNotSupported: string
			microphoneSecurityError: string
			microphoneAccessFailed: string
		},
	): string {
		switch (error.name) {
			case "NotAllowedError":
				return errorMessages.microphonePermissionDenied
			case "NotFoundError":
				return errorMessages.microphoneNotFound
			case "NotReadableError":
				return errorMessages.microphoneNotReadable
			case "OverconstrainedError":
				return errorMessages.microphoneOverconstrained
			case "NotSupportedError":
				return errorMessages.microphoneNotSupported
			case "SecurityError":
				return errorMessages.microphoneSecurityError
			default:
				return error.message || errorMessages.microphoneAccessFailed
		}
	}

	/**
	 * 检查错误是否为权限被拒绝
	 */
	static isPermissionDeniedError(error: Error & { name?: string }): boolean {
		return error.name === "NotAllowedError"
	}

	/**
	 * 尝试打开权限设置页面（浏览器或App环境）
	 */
	static openPermissionSettings(): boolean {
		if (isMagicApp) {
			// App环境下打开系统设置
			return this.openAppPermissionSettings()
		} else {
			// 浏览器环境下打开浏览器设置
			return this.openBrowserPermissionSettings()
		}
	}

	/**
	 * 打开浏览器权限设置页面
	 * 注意：现代浏览器不允许网页直接打开 chrome:// 等内部链接
	 */
	static openBrowserPermissionSettings(): boolean {
		// 浏览器安全策略不允许网页打开内部设置页面
		// 只能提供手动指引
		console.log("Browser security policy prevents opening internal settings pages")
		return false
	}

	/**
	 * 打开App权限设置页面
	 */
	static openAppPermissionSettings(): boolean {
		try {
			// 在App环境中，尝试调用原生接口打开设置
			if (window.location.href.indexOf("app-settings://") === 0) {
				window.location.href = "app-settings://permissions/microphone"
				return true
			}
			// 其他App环境的处理方式可以在这里添加
			return false
		} catch (error) {
			console.warn("Failed to open app permission settings:", error)
			return false
		}
	}

	/**
	 * 检查是否支持自动打开权限设置
	 * 注意：现代浏览器出于安全考虑不允许网页直接打开 chrome:// 等内部链接
	 */
	static canOpenPermissionSettings(): boolean {
		// 所有环境都不支持自动打开，只提供手动指引
		return false
	}

	/**
	 * 获取环境特定的手动设置权限指引
	 */
	static getPermissionInstructions(instructions: {
		chrome?: string
		edge?: string
		firefox?: string
		safari?: string
		ios?: string
		android?: string
		default: string
	}): string {
		if (isMagicApp) {
			if (isIosMagicApp) {
				return instructions.ios || instructions.default
			} else if (isAndroidMagicApp) {
				return instructions.android || instructions.default
			} else {
				return instructions.default
			}
		} else {
			// 浏览器环境下的指引
			const { name } = getBrowserInfo()
			switch (name.toLowerCase()) {
				case "chrome":
				case "chromium":
					return instructions.chrome || instructions.default
				case "edge":
					return instructions.edge || instructions.default
				case "firefox":
					return instructions.firefox || instructions.default
				case "safari":
					return instructions.safari || instructions.default
				default:
					return instructions.default
			}
		}
	}

	/**
	 * 获取浏览器特定的手动设置权限指引（兼容旧版本）
	 * @deprecated 请使用 getPermissionInstructions 方法
	 */
	static getBrowserPermissionInstructions(instructions: {
		chrome: string
		edge: string
		firefox: string
		safari: string
		default: string
	}): string {
		return this.getPermissionInstructions(instructions)
	}
}
