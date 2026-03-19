import { logger as Logger } from "@/utils/log"
import type { NativeStreamStatus } from "@/platform/native"

const logger = Logger.createLogger("StreamChunkManager", { enableConfig: { console: false } })

// File chunk state for a single file
interface FileChunkState {
	fileIndex: number
	filePath: string
	chunks: Map<number, string> // chunkId -> base64Data
	expectedNextChunkId: number
	isComplete: boolean
	startTime: number
	lastChunkTime: number
}

// Configuration options
interface StreamChunkManagerOptions {
	timeout?: number // Timeout in milliseconds (default: 30000)
}

/**
 * StreamChunkManager - Manages streaming file chunks from app
 * Handles multiple files concurrently with chunk ordering validation
 */
export class StreamChunkManager {
	private fileChunks: Map<number, FileChunkState>
	private timeout: number
	private timeoutTimers: Map<number, NodeJS.Timeout>

	constructor(options: StreamChunkManagerOptions = {}) {
		this.fileChunks = new Map()
		this.timeout = options.timeout || 30000 // 30 seconds default
		this.timeoutTimers = new Map()
	}

	/**
	 * Add a chunk for a file
	 * @throws Error if chunk order is invalid or file already completed
	 */
	addChunk(
		fileIndex: number,
		chunkId: number,
		base64Data: string | undefined,
		streamStatus: NativeStreamStatus,
	): void {
		logger.log(
			`Adding chunk: fileIndex=${fileIndex}, chunkId=${chunkId}, status=${streamStatus}`,
		)

		// Initialize file if not exists and this is the first chunk
		// This handles cases where stream_status=2 arrives as the first packet
		if (!this.fileChunks.has(fileIndex) && chunkId === 0) {
			this.initializeFile(fileIndex)
		}

		// Handle explicit start status
		if (streamStatus === 0 && !this.fileChunks.has(fileIndex)) {
			this.initializeFile(fileIndex)
		}

		// Get or create file state
		const fileState = this.fileChunks.get(fileIndex)
		if (!fileState) {
			throw new Error(
				`File ${fileIndex} not initialized. Invalid chunk_id=${chunkId} or missing initialization.`,
			)
		}

		// Check if already complete
		if (fileState.isComplete) {
			throw new Error(`File ${fileIndex} already completed`)
		}

		// Validate chunk order - chunks must be sequential
		if (chunkId !== fileState.expectedNextChunkId) {
			throw new Error(
				`Invalid chunk order for file ${fileIndex}: expected ${fileState.expectedNextChunkId}, got ${chunkId}`,
			)
		}

		// Store chunk data if provided
		if (base64Data) {
			fileState.chunks.set(chunkId, base64Data)
		}

		// Update state
		fileState.expectedNextChunkId = chunkId + 1
		fileState.lastChunkTime = Date.now()

		// Mark as complete if this is the final chunk
		if (streamStatus === 2) {
			fileState.isComplete = true
			this.clearTimeout(fileIndex)
			logger.log(`File ${fileIndex} completed with ${fileState.chunks.size} chunks`)
		} else {
			// Reset timeout for ongoing transfer
			this.resetTimeout(fileIndex)
		}
	}

	/**
	 * Initialize a new file for chunk collection
	 */
	private initializeFile(fileIndex: number): void {
		if (this.fileChunks.has(fileIndex)) {
			logger.warn(`File ${fileIndex} already initialized, resetting`)
			this.clearFile(fileIndex)
		}

		const fileState: FileChunkState = {
			fileIndex,
			filePath: "",
			chunks: new Map(),
			expectedNextChunkId: 0,
			isComplete: false,
			startTime: Date.now(),
			lastChunkTime: Date.now(),
		}

		this.fileChunks.set(fileIndex, fileState)
		this.setupTimeout(fileIndex)
		logger.log(`Initialized file ${fileIndex}`)
	}

	/**
	 * Setup timeout for a file
	 */
	private setupTimeout(fileIndex: number): void {
		this.clearTimeout(fileIndex)

		const timer = setTimeout(() => {
			logger.error(`File ${fileIndex} timed out after ${this.timeout}ms`)
			this.clearFile(fileIndex)
		}, this.timeout)

		this.timeoutTimers.set(fileIndex, timer)
	}

	/**
	 * Reset timeout for a file (called when new chunk arrives)
	 */
	private resetTimeout(fileIndex: number): void {
		this.setupTimeout(fileIndex)
	}

	/**
	 * Clear timeout for a file
	 */
	private clearTimeout(fileIndex: number): void {
		const timer = this.timeoutTimers.get(fileIndex)
		if (timer) {
			clearTimeout(timer)
			this.timeoutTimers.delete(fileIndex)
		}
	}

	/**
	 * Check if a file has completed receiving all chunks
	 */
	isFileComplete(fileIndex: number): boolean {
		const fileState = this.fileChunks.get(fileIndex)
		return fileState?.isComplete ?? false
	}

	/**
	 * Get merged base64 data for a completed file
	 * @returns Merged base64 string or null if not complete
	 */
	getMergedBase64(fileIndex: number): string | null {
		const fileState = this.fileChunks.get(fileIndex)

		if (!fileState || !fileState.isComplete) {
			logger.warn(`Cannot merge file ${fileIndex}: not complete`)
			return null
		}

		// Sort chunks by ID and concatenate
		const sortedChunks = Array.from(fileState.chunks.entries())
			.sort((a, b) => a[0] - b[0])
			.map((entry) => entry[1])

		const mergedBase64 = sortedChunks.join("")
		logger.log(`Merged ${sortedChunks.length} chunks for file ${fileIndex}`)

		return mergedBase64
	}

	/**
	 * Get file path for a file
	 */
	getFilePath(fileIndex: number): string | null {
		return this.fileChunks.get(fileIndex)?.filePath ?? null
	}

	/**
	 * Set file path for a file
	 */
	setFilePath(fileIndex: number, filePath: string): void {
		const fileState = this.fileChunks.get(fileIndex)
		if (fileState) {
			fileState.filePath = filePath
		}
	}

	/**
	 * Clear a specific file from memory
	 */
	clearFile(fileIndex: number): void {
		this.clearTimeout(fileIndex)
		this.fileChunks.delete(fileIndex)
		logger.log(`Cleared file ${fileIndex}`)
	}

	/**
	 * Clear all files from memory
	 */
	clearAll(): void {
		// Clear all timeouts
		for (const fileIndex of this.fileChunks.keys()) {
			this.clearTimeout(fileIndex)
		}

		this.fileChunks.clear()
		logger.log("Cleared all files")
	}

	/**
	 * Get statistics for debugging
	 */
	getStats(): {
		totalFiles: number
		completedFiles: number
		pendingFiles: number
	} {
		let completed = 0
		let pending = 0

		for (const fileState of this.fileChunks.values()) {
			if (fileState.isComplete) {
				completed++
			} else {
				pending++
			}
		}

		return {
			totalFiles: this.fileChunks.size,
			completedFiles: completed,
			pendingFiles: pending,
		}
	}
}

export default StreamChunkManager
