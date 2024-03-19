/**
 * Voice enhancement service for microphone audio
 */

import type { LoggerInterface } from "../types/RecorderDependencies"
import type { VoiceEnhancementConfig } from "../types/RecorderTypes"

interface VoiceEnhancementSetupOptions {
	audioContext: AudioContext
	baseGain: number
}

interface VoiceEnhancementUpdateOptions {
	audioContext: AudioContext
	pcmData: Int16Array
}

export class VoiceEnhancementService {
	private readonly config: VoiceEnhancementConfig
	private readonly logger: LoggerInterface
	private gainNode: GainNode | null = null
	private compressorNode: DynamicsCompressorNode | null = null
	private baseGain = 1
	private currentGain = 1
	private lastUpdateAt = 0
	private isInputConnected = false
	private connectedTargets = new WeakSet<AudioNode>()

	constructor(config: VoiceEnhancementConfig, logger: LoggerInterface) {
		this.config = config
		this.logger = logger
	}

	isEnabled(): boolean {
		return this.config.enabled
	}

	isReady(): boolean {
		return Boolean(this.gainNode && this.compressorNode)
	}

	setup({ audioContext, baseGain }: VoiceEnhancementSetupOptions): void {
		if (!this.config.enabled) return

		this.cleanup()

		this.baseGain = sanitizeGain(baseGain)
		this.currentGain = 1

		this.gainNode = audioContext.createGain()
		this.gainNode.gain.value = this.baseGain

		this.compressorNode = audioContext.createDynamicsCompressor()
		this.compressorNode.threshold.value = this.config.compressor.threshold
		this.compressorNode.ratio.value = this.config.compressor.ratio
		this.compressorNode.attack.value = this.config.compressor.attack
		this.compressorNode.release.value = this.config.compressor.release

		if (typeof this.config.compressor.knee === "number") {
			this.compressorNode.knee.value = this.config.compressor.knee
		}

		this.gainNode.connect(this.compressorNode)

		this.logger.log("Voice enhancement pipeline initialized", {
			baseGain: this.baseGain,
			minGain: this.config.minGain,
			maxGain: this.config.maxGain,
		})
	}

	connectSource(source: MediaStreamAudioSourceNode): void {
		if (!this.gainNode || this.isInputConnected) return
		source.connect(this.gainNode)
		this.isInputConnected = true
	}

	connectTarget(target: AudioNode): void {
		if (!this.compressorNode || this.connectedTargets.has(target)) return
		this.compressorNode.connect(target)
		this.connectedTargets.add(target)
	}

	updateGain({ audioContext, pcmData }: VoiceEnhancementUpdateOptions): void {
		if (!this.gainNode || !this.config.enabled) return
		if (pcmData.length === 0) return

		const now = audioContext.currentTime
		if (now - this.lastUpdateAt < UPDATE_INTERVAL_SECONDS) return

		const rms = calculateRms(pcmData)
		if (!Number.isFinite(rms)) return

		const targetGain = this.getTargetGain(rms)
		const delta = Math.abs(targetGain - this.currentGain)
		if (delta < MIN_GAIN_DELTA) return

		const isIncreasing = targetGain > this.currentGain
		const timeConstant = getTimeConstantSeconds({
			attackMs: this.config.attackMs,
			releaseMs: this.config.releaseMs,
			isIncreasing,
		})

		this.gainNode.gain.cancelScheduledValues(now)
		this.gainNode.gain.setTargetAtTime(targetGain * this.baseGain, now, timeConstant)

		this.currentGain = targetGain
		this.lastUpdateAt = now
	}

	cleanup(): void {
		if (this.gainNode) {
			this.gainNode.disconnect()
			this.gainNode = null
		}
		if (this.compressorNode) {
			this.compressorNode.disconnect()
			this.compressorNode = null
		}
		this.connectedTargets = new WeakSet<AudioNode>()
		this.isInputConnected = false
		this.lastUpdateAt = 0
		this.currentGain = 1
	}

	private getTargetGain(rms: number): number {
		if (rms < this.config.silenceRms) return this.config.minGain
		const gain = this.config.targetRms / Math.max(rms, MIN_RMS_VALUE)
		return clampGain(gain, this.config.minGain, this.config.maxGain)
	}
}

function calculateRms(pcmData: Int16Array): number {
	let sum = 0
	for (let i = 0; i < pcmData.length; i++) {
		const sample = pcmData[i] / PCM_NORMALIZATION
		sum += sample * sample
	}
	return Math.sqrt(sum / pcmData.length)
}

function clampGain(value: number, minGain: number, maxGain: number): number {
	if (!Number.isFinite(value)) return minGain
	return Math.min(maxGain, Math.max(minGain, value))
}

function sanitizeGain(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 1
	return value
}

function getTimeConstantSeconds(options: {
	attackMs: number
	releaseMs: number
	isIncreasing: boolean
}): number {
	const { attackMs, releaseMs, isIncreasing } = options
	const timeMs = isIncreasing ? attackMs : releaseMs
	const timeSeconds = Math.max(timeMs, MIN_TIME_MS) / 1000
	return timeSeconds
}

const PCM_NORMALIZATION = 32768
const MIN_RMS_VALUE = 0.000001
const MIN_TIME_MS = 1
const MIN_GAIN_DELTA = 0.02
const UPDATE_INTERVAL_SECONDS = 0.08
