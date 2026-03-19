/**
 * Factory for creating audio source strategies
 * 音频源策略工厂
 */

import type { AudioSourceStrategy } from "../strategies/AudioSourceStrategy"
import { MicrophoneSourceStrategy } from "../strategies/MicrophoneSourceStrategy"
import { SystemAudioSourceStrategy } from "../strategies/SystemAudioSourceStrategy"
import { MixedAudioSourceStrategy } from "../strategies/MixedAudioSourceStrategy"
import type { AudioSourceType, RecorderCoreConfig } from "../types/RecorderTypes"
import type { RecorderDependencies } from "../types/RecorderDependencies"
import { AudioSourceNotSupportedError } from "../types/RecorderErrors"

/**
 * AudioSourceStrategyFactory creates appropriate audio source strategy
 * AudioSourceStrategyFactory 创建合适的音频源策略
 */
export class AudioSourceStrategyFactory {
	/**
	 * Create audio source strategy based on source type
	 * 根据音频源类型创建音频源策略
	 */
	static create(
		sourceType: AudioSourceType,
		config: RecorderCoreConfig,
		dependencies: RecorderDependencies,
	): AudioSourceStrategy {
		switch (sourceType) {
			case "microphone":
				return new MicrophoneSourceStrategy(config, dependencies)

			case "system":
				return new SystemAudioSourceStrategy(config, dependencies)

			case "both":
				return new MixedAudioSourceStrategy(config, dependencies)

			default:
				throw new AudioSourceNotSupportedError(
					sourceType,
					`Unknown audio source type: ${sourceType}`,
				)
		}
	}

	/**
	 * Check if running on mobile device
	 * 检查是否在移动设备上运行
	 */
	private static isMobileDevice(): boolean {
		if (typeof window === "undefined") return false

		const userAgent =
			navigator.userAgent ||
			navigator.vendor ||
			(window as Window & { opera?: string }).opera ||
			""
		return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
			userAgent.toLowerCase(),
		)
	}

	/**
	 * Check if running in secure context (HTTPS or localhost)
	 * 检查是否在安全上下文中运行（HTTPS 或 localhost）
	 */
	private static isSecureContext(): boolean {
		if (typeof window === "undefined") return false

		// Check if isSecureContext is available
		if (typeof window.isSecureContext !== "undefined") {
			return window.isSecureContext
		}

		// Fallback: check protocol and hostname
		const { protocol, hostname } = window.location
		return (
			protocol === "https:" ||
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "[::1]"
		)
	}

	/**
	 * Get browser information
	 * 获取浏览器信息
	 */
	private static getBrowserInfo(): {
		name: string
		isChromium: boolean
		isFirefox: boolean
		isSafari: boolean
	} {
		if (typeof window === "undefined") {
			return { name: "unknown", isChromium: false, isFirefox: false, isSafari: false }
		}

		const userAgent = navigator.userAgent
		const isChromium = /chrome|chromium|edg/i.test(userAgent)
		const isFirefox = /firefox/i.test(userAgent)
		const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)

		let name = "unknown"
		if (isChromium) name = "Chrome/Edge"
		else if (isFirefox) name = "Firefox"
		else if (isSafari) name = "Safari"

		return { name, isChromium, isFirefox, isSafari }
	}

	/**
	 * Check if audio source type is supported
	 * 检查音频源类型是否支持
	 */
	static isSupported(sourceType: AudioSourceType): {
		supported: boolean
		message?: string
	} {
		// Check browser environment
		if (typeof window === "undefined") {
			return { supported: false, message: "Not running in browser environment" }
		}

		// Check secure context
		if (!this.isSecureContext()) {
			return {
				supported: false,
				message:
					"Media capture requires a secure context (HTTPS). Please use HTTPS or localhost.",
			}
		}

		// Check navigator.mediaDevices availability
		if (!navigator.mediaDevices) {
			return {
				supported: false,
				message: "MediaDevices API is not available in this browser",
			}
		}

		// Check MediaRecorder availability
		if (typeof MediaRecorder === "undefined") {
			return {
				supported: false,
				message: "MediaRecorder API is not supported in this browser",
			}
		}

		const hasGetUserMedia = !!navigator.mediaDevices.getUserMedia
		const hasDisplayMedia = !!navigator.mediaDevices.getDisplayMedia
		const isMobile = this.isMobileDevice()
		const browserInfo = this.getBrowserInfo()

		switch (sourceType) {
			case "microphone":
				if (!hasGetUserMedia) {
					return {
						supported: false,
						message: `Microphone access not supported in ${browserInfo.name}`,
					}
				}
				return { supported: true }

			case "system":
				if (!hasDisplayMedia) {
					return {
						supported: false,
						message: `System audio capture not supported in ${browserInfo.name}. Please use Chrome, Edge, or Firefox.`,
					}
				}

				// Mobile devices don't support system audio capture
				if (isMobile) {
					return {
						supported: false,
						message:
							"System audio capture is not supported on mobile devices. Please use a desktop browser.",
					}
				}

				// Safari has limited support for system audio
				if (browserInfo.isSafari) {
					return {
						supported: false,
						message:
							"System audio capture is not fully supported in Safari. Please use Chrome, Edge, or Firefox for better compatibility.",
					}
				}

				return { supported: true }

			case "both":
				// Check both APIs are available
				if (!hasGetUserMedia && !hasDisplayMedia) {
					return {
						supported: false,
						message: "Neither microphone nor system audio capture is supported",
					}
				}

				if (!hasGetUserMedia) {
					return {
						supported: false,
						message: `Microphone access not supported in ${browserInfo.name}`,
					}
				}

				if (!hasDisplayMedia) {
					return {
						supported: false,
						message: `System audio capture not supported in ${browserInfo.name}. Please use Chrome, Edge, or Firefox.`,
					}
				}

				// Mobile devices don't support system audio capture
				if (isMobile) {
					return {
						supported: false,
						message:
							"Mixed audio (microphone + system) is not supported on mobile devices. Only microphone capture is available.",
					}
				}

				// Safari has limited support for system audio
				if (browserInfo.isSafari) {
					return {
						supported: false,
						message:
							"Mixed audio capture is not fully supported in Safari. Please use Chrome, Edge, or Firefox.",
					}
				}

				return { supported: true }

			default:
				return { supported: false, message: `Unknown audio source type: ${sourceType}` }
		}
	}
}
