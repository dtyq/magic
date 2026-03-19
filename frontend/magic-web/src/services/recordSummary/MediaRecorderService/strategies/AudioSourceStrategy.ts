/**
 * Audio source strategy interface for different audio capture modes
 * 音频源策略接口，用于不同的音频捕获模式
 */

import type { AudioRecorder } from "../types/RecorderTypes"

/**
 * Audio source initialization result
 * 音频源初始化结果
 */
export interface AudioSourceInitResult {
	mediaStream: MediaStream
	audioRecorder: AudioRecorder
}

/**
 * AudioSourceStrategy defines the interface for audio capture strategies
 * AudioSourceStrategy 定义音频捕获策略的接口
 */
export interface AudioSourceStrategy {
	/**
	 * Initialize the audio source and create recorder instance
	 * 初始化音频源并创建录音器实例
	 * Note: All modes now use scriptProcessor for unified audio processing
	 * 注意：所有模式现在都使用 scriptProcessor 进行统一的音频处理
	 */
	initialize(): Promise<AudioSourceInitResult>

	/**
	 * Cleanup all resources used by this strategy
	 * 清理此策略使用的所有资源
	 */
	cleanup(): Promise<void>

	/**
	 * Get the media stream for silence detection or other purposes
	 * 获取用于静音检测或其他用途的媒体流
	 */
	getMediaStream(): MediaStream | null

	/**
	 * Get the strategy name
	 * 获取策略名称
	 */
	getName(): string
}
