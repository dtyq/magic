/**
 * Packet Logger for Voice Client
 * Records all sent and received packets for debugging and analysis
 */

import { loadJSZip } from "@/opensource/lib/jszip"

export interface PacketLogEntry {
	id: string
	timestamp: number
	type: "sent" | "received"
	direction: "outbound" | "inbound"
	messageType: string
	size: number
	sequence?: number
	data: ArrayBuffer
	metadata: {
		wsUrl?: string
		connectionId?: string
		protocolType?: "audio" | "text" | "control"
		isLastPacket?: boolean
		audioStats?: {
			samples: number
			durationMs: number
		}
	}
}

export interface PacketLogFilter {
	type?: "sent" | "received"
	messageType?: string
	dateRange?: {
		start: Date
		end: Date
	}
	connectionId?: string
	minSize?: number
	maxSize?: number
}

export interface ConnectionSession {
	connectionId: string
	startTime: number
	endTime?: number
	totalPackets: number
	totalSize: number
	status: "active" | "completed" | "error"
	logs: PacketLogEntry[]
}

export interface PacketLogStats {
	totalPackets: number
	totalSize: number
	sentPackets: number
	receivedPackets: number
	averagePacketSize: number
	timeRange: {
		start: number
		end: number
	}
	messageTypes: Record<string, number>
}

export interface PacketLoggerConfig {
	maxEntries?: number // Maximum number of entries to keep in memory
	enableIndexedDB?: boolean // Whether to store logs in IndexedDB
	enableAutoCleanup?: boolean // Whether to auto-cleanup old logs
	cleanupInterval?: number // Cleanup interval in ms (default: 5 minutes)
	maxAge?: number // Maximum age of logs in ms (default: 1 hour)
	enableDetailedLogging?: boolean // Whether to enable detailed logger logging (default: true)
	batchSize?: number // Batch size for IndexedDB operations (default: 10)

	// Timeout and retry settings
	indexedDBTimeout?: number // Timeout for IndexedDB operations in ms (default: 10 seconds)
	maxRetryAttempts?: number // Maximum retry attempts for failed operations (default: 3)
	retryDelay?: number // Delay between retry attempts in ms (default: 1000)
}

const logger = console

export class PacketLogger {
	private logs: PacketLogEntry[] = []
	private sessions: Map<string, ConnectionSession> = new Map()
	private currentConnectionId: string | null = null
	private config: Required<PacketLoggerConfig>
	private cleanupTimer?: NodeJS.Timeout
	private dbName = "VoiceClientPacketLogs"
	private dbVersion = 1
	private db?: IDBDatabase

	// Batch processing for IndexedDB
	private pendingBatch: PacketLogEntry[] = []
	private batchTimer?: NodeJS.Timeout

	// Timeout and retry tracking
	private operationTimeouts = new Map<string, NodeJS.Timeout>()

	constructor(config: PacketLoggerConfig = {}) {
		this.config = {
			maxEntries: config.maxEntries ?? 1000,
			enableIndexedDB: config.enableIndexedDB ?? true,
			enableAutoCleanup: config.enableAutoCleanup ?? true,
			cleanupInterval: config.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
			maxAge: config.maxAge ?? 60 * 60 * 1000, // 1 hour
			enableDetailedLogging: config.enableDetailedLogging ?? true,
			batchSize: config.batchSize ?? 10,
			indexedDBTimeout: config.indexedDBTimeout ?? 10 * 1000, // 10 seconds
			maxRetryAttempts: config.maxRetryAttempts ?? 3,
			retryDelay: config.retryDelay ?? 1000, // 1 second
		}

		if (this.config.enableIndexedDB) {
			this.initIndexedDB()
		}

		if (this.config.enableAutoCleanup) {
			this.startAutoCleanup()
		}
	}

	/**
	 * Execute a promise with timeout and retry logic
	 */
	private async withTimeoutAndRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		attempt = 1,
	): Promise<T> {
		const operationId = `${operationName}-${Date.now()}-${attempt}`

		try {
			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				const timeout = setTimeout(() => {
					reject(
						new Error(
							`${operationName} timed out after ${this.config.indexedDBTimeout}ms`,
						),
					)
				}, this.config.indexedDBTimeout)

				this.operationTimeouts.set(operationId, timeout)
			})

			// Race between operation and timeout
			const result = await Promise.race([operation(), timeoutPromise])

			// Clean up timeout
			const timeout = this.operationTimeouts.get(operationId)
			if (timeout) {
				clearTimeout(timeout)
				this.operationTimeouts.delete(operationId)
			}

			return result
		} catch (error) {
			// Clean up timeout
			const timeout = this.operationTimeouts.get(operationId)
			if (timeout) {
				clearTimeout(timeout)
				this.operationTimeouts.delete(operationId)
			}

			const isTimeout = (error as Error).message.includes("timed out")
			const shouldRetry =
				attempt < this.config.maxRetryAttempts &&
				(isTimeout || this.isRetryableError(error))

			if (shouldRetry) {
				logger.warn(
					`[PacketLogger] ${operationName} failed (attempt ${attempt}/${this.config.maxRetryAttempts}):`,
					error,
				)

				// Wait before retry
				await this.delay(this.config.retryDelay * attempt) // Exponential backoff

				return this.withTimeoutAndRetry(operation, operationName, attempt + 1)
			} else {
				logger.error(
					`[PacketLogger] ${operationName} failed after ${attempt} attempts:`,
					error,
				)
				throw error
			}
		}
	}

	/**
	 * Check if an error is retryable
	 */
	private isRetryableError(error: unknown): boolean {
		if (!(error instanceof Error)) return false

		const message = error.message.toLowerCase()
		const name = error.name?.toLowerCase()

		// Common retryable IndexedDB errors
		return (
			message.includes("blocked") ||
			message.includes("quota") ||
			message.includes("transaction") ||
			message.includes("version") ||
			name === "aborterror" ||
			name === "timeouterror" ||
			name === "networkerror"
		)
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	private async initIndexedDB(): Promise<void> {
		if (typeof indexedDB === "undefined") {
			const envType = typeof WorkerGlobalScope !== "undefined" ? "worker" : "main thread"
			logger.warn(`[PacketLogger] IndexedDB not available in ${envType}`)
			return
		}

		// Log successful availability
		const envType = typeof WorkerGlobalScope !== "undefined" ? "worker" : "main thread"
		logger.log(`[PacketLogger] IndexedDB available in ${envType}`)

		try {
			await this.withTimeoutAndRetry(
				() => this.openIndexedDBConnection(),
				"IndexedDB initialization",
			)
		} catch (error) {
			logger.error(
				"[PacketLogger] Failed to initialize IndexedDB, falling back to memory-only mode:",
				error,
			)
			// Gracefully degrade to memory-only mode
			this.config.enableIndexedDB = false
		}
	}

	/**
	 * Open IndexedDB connection with proper error handling
	 */
	private openIndexedDBConnection(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion)

			request.onerror = () => {
				const error = request.error || new Error("Unknown IndexedDB error")
				reject(error)
			}

			request.onsuccess = () => {
				this.db = request.result

				// Handle unexpected close events
				this.db.onclose = () => {
					logger.warn("[PacketLogger] IndexedDB connection closed unexpectedly")
					this.db = undefined
				}

				// Handle version change events (when another tab upgrades the DB)
				this.db.onversionchange = () => {
					logger.warn(
						"[PacketLogger] IndexedDB version change detected, closing connection",
					)
					this.db?.close()
					this.db = undefined
				}

				resolve()
			}

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result

				try {
					// Create object store for packet logs
					if (!db.objectStoreNames.contains("packetLogs")) {
						const store = db.createObjectStore("packetLogs", { keyPath: "id" })
						store.createIndex("timestamp", "timestamp")
						store.createIndex("type", "type")
						store.createIndex("connectionId", "metadata.connectionId")
					}
				} catch (upgradeError) {
					logger.error(
						"[PacketLogger] Error during IndexedDB schema upgrade:",
						upgradeError,
					)
					reject(upgradeError)
				}
			}

			request.onblocked = () => {
				logger.warn("[PacketLogger] IndexedDB upgrade blocked by another connection")
				reject(new Error("IndexedDB upgrade blocked"))
			}
		})
	}

	private startAutoCleanup(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanupOldLogs()
		}, this.config.cleanupInterval)
	}

	private cleanupOldLogs(): void {
		const now = Date.now()
		const cutoff = now - this.config.maxAge

		// Clean up in-memory logs
		const beforeCount = this.logs.length
		this.logs = this.logs.filter((log) => log.timestamp >= cutoff)
		const afterCount = this.logs.length

		if (beforeCount !== afterCount) {
			logger.log(`[PacketLogger] Cleaned up ${beforeCount - afterCount} old logs from memory`)
		}

		// Clean up IndexedDB logs
		if (this.db) {
			this.cleanupIndexedDBLogs(cutoff)
		}
	}

	private async cleanupIndexedDBLogs(cutoff: number): Promise<void> {
		if (!this.db) return

		try {
			await this.withTimeoutAndRetry(
				() => this.performIndexedDBCleanup(cutoff),
				"IndexedDB cleanup",
			)
		} catch (error) {
			logger.warn("[PacketLogger] IndexedDB cleanup failed:", error)
			// Non-critical operation, continue without throwing
		}
	}

	/**
	 * Perform the actual IndexedDB cleanup operation
	 */
	private performIndexedDBCleanup(cutoff: number): Promise<void> {
		if (!this.db) return Promise.resolve()

		const transaction = this.db.transaction(["packetLogs"], "readwrite")
		const store = transaction.objectStore("packetLogs")
		const index = store.index("timestamp")
		const range = IDBKeyRange.upperBound(cutoff)

		return new Promise((resolve, reject) => {
			const request = index.openCursor(range)
			let deletedCount = 0

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
				if (cursor) {
					cursor.delete()
					deletedCount++
					cursor.continue()
				} else {
					if (deletedCount > 0) {
						logger.log(
							`[PacketLogger] Cleaned up ${deletedCount} old logs from IndexedDB`,
						)
					}
					resolve()
				}
			}

			request.onerror = () => {
				const error = request.error || new Error("IndexedDB cleanup cursor error")
				reject(error)
			}

			// Handle transaction errors
			transaction.onerror = () => {
				const error = transaction.error || new Error("IndexedDB cleanup transaction error")
				reject(error)
			}
		})
	}

	logPacket(entry: Omit<PacketLogEntry, "id" | "timestamp">): void {
		const logEntry: PacketLogEntry = {
			...entry,
			id: this.generateId(),
			timestamp: Date.now(),
		}

		// Add to in-memory logs
		this.logs.push(logEntry)

		// Add to current session if exists
		const connectionId = entry.metadata.connectionId || this.currentConnectionId
		if (connectionId) {
			let session = this.sessions.get(connectionId)

			// Create session if it doesn't exist
			if (!session) {
				this.startSession(connectionId)
				session = this.sessions.get(connectionId)
			}

			if (session) {
				session.logs.push(logEntry)
				session.totalPackets++
				session.totalSize += entry.size
			}
		}

		// Enforce max entries limit with better performance
		if (this.logs.length > this.config.maxEntries) {
			// Remove oldest 10% when limit reached to avoid frequent operations
			const removeCount = Math.floor(this.config.maxEntries * 0.1)
			this.logs.splice(0, removeCount)
		}

		// Store in IndexedDB if enabled (use batching for better performance)
		if (this.config.enableIndexedDB && this.db) {
			this.addToBatch(logEntry)
		}

		// Reduce logger.log frequency in production to improve performance
		if (this.config.enableDetailedLogging !== false) {
			logger.log(
				`[PacketLogger] Logged ${entry.direction} packet: ${entry.messageType}, size: ${
					entry.size
				} bytes (Session: ${connectionId || "unknown"})`,
			)
		}
	}

	/**
	 * Add entry to batch for efficient IndexedDB storage
	 */
	private addToBatch(entry: PacketLogEntry): void {
		this.pendingBatch.push(entry)

		// Process batch when it reaches the configured size
		if (this.pendingBatch.length >= this.config.batchSize) {
			this.processBatch()
		} else {
			// Schedule batch processing if not already scheduled
			if (!this.batchTimer) {
				this.batchTimer = setTimeout(() => {
					this.processBatch()
				}, 1000) // Process batch after 1 second if not full
			}
		}
	}

	/**
	 * Process pending batch and store in IndexedDB
	 */
	private async processBatch(): Promise<void> {
		if (this.pendingBatch.length === 0 || !this.db) return

		const batchToProcess = [...this.pendingBatch]
		this.pendingBatch = []

		// Clear timer
		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = undefined
		}

		try {
			await this.withTimeoutAndRetry(
				() => this.storeBatchInIndexedDB(batchToProcess),
				`Batch storage (${batchToProcess.length} entries)`,
			)
		} catch (error) {
			logger.warn("[PacketLogger] Failed to store batch in IndexedDB after retries:", error)
			// Don't re-add to pending to prevent infinite loops
			// Log the loss for monitoring purposes
			logger.error(
				`[PacketLogger] Lost ${batchToProcess.length} log entries due to persistent storage failures`,
			)
		}
	}

	/**
	 * Store multiple entries in IndexedDB as a batch operation
	 */
	private async storeBatchInIndexedDB(entries: PacketLogEntry[]): Promise<void> {
		if (!this.db || entries.length === 0) return

		const transaction = this.db.transaction(["packetLogs"], "readwrite")
		const store = transaction.objectStore("packetLogs")

		return new Promise((resolve, reject) => {
			let completed = 0
			const total = entries.length

			if (total === 0) {
				resolve()
				return
			}

			entries.forEach((entry) => {
				const request = store.put(entry)

				request.onsuccess = () => {
					completed++
					if (completed === total) {
						resolve()
					}
				}

				request.onerror = () => {
					reject(request.error)
				}
			})

			// Handle transaction errors
			transaction.onerror = () => reject(transaction.error)
		})
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Start a new connection session
	 */
	startSession(connectionId: string): void {
		logger.log(`[PacketLogger] Starting new session: ${connectionId}`)

		// End previous session if exists
		if (this.currentConnectionId && this.sessions.has(this.currentConnectionId)) {
			this.endSession(this.currentConnectionId, "completed")
		}

		this.currentConnectionId = connectionId
		const session: ConnectionSession = {
			connectionId,
			startTime: Date.now(),
			totalPackets: 0,
			totalSize: 0,
			status: "active",
			logs: [],
		}

		this.sessions.set(connectionId, session)
		logger.log(`[PacketLogger] Session ${connectionId} started`)
	}

	/**
	 * End a connection session
	 */
	endSession(connectionId: string, status: "completed" | "error" = "completed"): void {
		const session = this.sessions.get(connectionId)
		if (session && session.status === "active") {
			session.endTime = Date.now()
			session.status = status
			logger.log(`[PacketLogger] Session ${connectionId} ended with status: ${status}`)

			if (this.currentConnectionId === connectionId) {
				this.currentConnectionId = null
			}
		}
	}

	/**
	 * Get all connection sessions
	 */
	getSessions(): ConnectionSession[] {
		return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime)
	}

	/**
	 * Get specific session by connectionId
	 */
	getSession(connectionId: string): ConnectionSession | undefined {
		return this.sessions.get(connectionId)
	}

	/**
	 * Get logs for specific connection ID
	 */
	getLogsByConnectionId(connectionId: string): PacketLogEntry[] {
		const session = this.sessions.get(connectionId)
		if (session) {
			return [...session.logs]
		}

		// Fallback: search in all logs
		return this.logs.filter((log) => log.metadata.connectionId === connectionId)
	}

	/**
	 * Export logs for specific connection ID
	 */
	async exportLogsByConnectionId(
		connectionId: string,
		format: "json" | "csv" = "json",
		options: {
			includeAudioFragments?: boolean
			sampleRate?: number
			bitsPerSample?: number
			includeAnalysis?: boolean
		} = {},
	): Promise<Blob | null> {
		const session = this.sessions.get(connectionId)
		if (!session) {
			logger.warn(`[PacketLogger] Session not found: ${connectionId}`)
			return null
		}

		// Create a filter for this specific connection
		const filter: PacketLogFilter = {
			connectionId,
		}

		// Use comprehensive export by default
		if (options.includeAudioFragments !== false) {
			return this.exportLogsWithAudioFragments(format, filter, options)
		} else {
			// Basic export without audio fragments
			return this.exportLogs(format, filter)
		}
	}

	/**
	 * Get session statistics
	 */
	getSessionStats(connectionId: string): {
		session: ConnectionSession | null
		stats: PacketLogStats | null
		duration: number
	} {
		const session = this.sessions.get(connectionId)
		if (!session) {
			return {
				session: null,
				stats: null,
				duration: 0,
			}
		}

		// Calculate session statistics
		const logs = session.logs
		const totalSize = logs.reduce((sum, log) => sum + log.size, 0)
		const sentPackets = logs.filter((log) => log.type === "sent").length
		const receivedPackets = logs.filter((log) => log.type === "received").length
		const averagePacketSize = totalSize / logs.length || 0

		const timestamps = logs.map((log) => log.timestamp)
		const timeRange =
			timestamps.length > 0
				? {
						start: Math.min(...timestamps),
						end: Math.max(...timestamps),
					}
				: { start: session.startTime, end: session.endTime || Date.now() }

		const messageTypes: Record<string, number> = {}
		logs.forEach((log) => {
			messageTypes[log.messageType] = (messageTypes[log.messageType] || 0) + 1
		})

		const stats: PacketLogStats = {
			totalPackets: logs.length,
			totalSize,
			sentPackets,
			receivedPackets,
			averagePacketSize,
			timeRange,
			messageTypes,
		}

		const duration = (session.endTime || Date.now()) - session.startTime

		return {
			session,
			stats,
			duration,
		}
	}

	getLogs(filter?: PacketLogFilter): PacketLogEntry[] {
		let filtered = [...this.logs]

		if (filter) {
			if (filter.type) {
				filtered = filtered.filter((log) => log.type === filter.type)
			}
			if (filter.messageType) {
				filtered = filtered.filter((log) => log.messageType === filter.messageType)
			}
			if (filter.dateRange) {
				const startTime = filter.dateRange.start.getTime()
				const endTime = filter.dateRange.end.getTime()
				filtered = filtered.filter(
					(log) => log.timestamp >= startTime && log.timestamp <= endTime,
				)
			}
			if (filter.connectionId) {
				filtered = filtered.filter(
					(log) => log.metadata.connectionId === filter.connectionId,
				)
			}
			if (filter.minSize !== undefined) {
				const minSize = filter.minSize
				filtered = filtered.filter((log) => log.size >= minSize)
			}
			if (filter.maxSize !== undefined) {
				const maxSize = filter.maxSize
				filtered = filtered.filter((log) => log.size <= maxSize)
			}
		}

		return filtered.sort((a, b) => a.timestamp - b.timestamp)
	}

	async getAllLogs(filter?: PacketLogFilter): Promise<PacketLogEntry[]> {
		// Combine memory logs with IndexedDB logs
		const memoryLogs = this.getLogs(filter)

		if (!this.config.enableIndexedDB || !this.db) {
			return memoryLogs
		}

		const dbLogs = await this.getLogsFromIndexedDB(filter)

		// Merge and deduplicate
		const allLogs = [...memoryLogs, ...dbLogs]
		const uniqueLogs = allLogs.filter(
			(log, index, arr) => arr.findIndex((l) => l.id === log.id) === index,
		)

		return uniqueLogs.sort((a, b) => a.timestamp - b.timestamp)
	}

	private async getLogsFromIndexedDB(filter?: PacketLogFilter): Promise<PacketLogEntry[]> {
		if (!this.db) return []

		try {
			return await this.withTimeoutAndRetry(
				() => this.performIndexedDBQuery(filter),
				"IndexedDB query",
			)
		} catch (error) {
			logger.warn("[PacketLogger] IndexedDB query failed, returning empty array:", error)
			return []
		}
	}

	/**
	 * Perform the actual IndexedDB query operation
	 */
	private performIndexedDBQuery(filter?: PacketLogFilter): Promise<PacketLogEntry[]> {
		if (!this.db) return Promise.resolve([])

		const db = this.db
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(["packetLogs"], "readonly")
			const store = transaction.objectStore("packetLogs")
			const request = store.getAll()

			request.onsuccess = () => {
				let logs = request.result as PacketLogEntry[]

				// Apply filters
				if (filter) {
					if (filter.type) {
						logs = logs.filter((log) => log.type === filter.type)
					}
					if (filter.messageType) {
						logs = logs.filter((log) => log.messageType === filter.messageType)
					}
					if (filter.dateRange) {
						const startTime = filter.dateRange.start.getTime()
						const endTime = filter.dateRange.end.getTime()
						logs = logs.filter(
							(log) => log.timestamp >= startTime && log.timestamp <= endTime,
						)
					}
					if (filter.connectionId) {
						logs = logs.filter(
							(log) => log.metadata.connectionId === filter.connectionId,
						)
					}
					if (filter.minSize !== undefined) {
						const minSize = filter.minSize
						logs = logs.filter((log) => log.size >= minSize)
					}
					if (filter.maxSize !== undefined) {
						const maxSize = filter.maxSize
						logs = logs.filter((log) => log.size <= maxSize)
					}
				}

				resolve(logs)
			}

			request.onerror = () => {
				const error = request.error || new Error("IndexedDB query error")
				reject(error)
			}

			// Handle transaction errors
			transaction.onerror = () => {
				const error = transaction.error || new Error("IndexedDB query transaction error")
				reject(error)
			}
		})
	}

	getStats(): PacketLogStats {
		const logs = this.logs

		if (logs.length === 0) {
			return {
				totalPackets: 0,
				totalSize: 0,
				sentPackets: 0,
				receivedPackets: 0,
				averagePacketSize: 0,
				timeRange: { start: 0, end: 0 },
				messageTypes: {},
			}
		}

		const totalPackets = logs.length
		const totalSize = logs.reduce((sum, log) => sum + log.size, 0)
		const sentPackets = logs.filter((log) => log.type === "sent").length
		const receivedPackets = logs.filter((log) => log.type === "received").length
		const averagePacketSize = totalSize / totalPackets

		const timestamps = logs.map((log) => log.timestamp)
		const timeRange = {
			start: Math.min(...timestamps),
			end: Math.max(...timestamps),
		}

		const messageTypes: Record<string, number> = {}
		logs.forEach((log) => {
			messageTypes[log.messageType] = (messageTypes[log.messageType] || 0) + 1
		})

		return {
			totalPackets,
			totalSize,
			sentPackets,
			receivedPackets,
			averagePacketSize,
			timeRange,
			messageTypes,
		}
	}

	async exportLogs(format: "json" | "csv" = "json", filter?: PacketLogFilter): Promise<Blob> {
		const logs = await this.getAllLogs(filter)

		if (format === "json") {
			const jsonData = {
				exportTimestamp: new Date().toISOString(),
				totalLogs: logs.length,
				logs: logs.map((log) => ({
					...log,
					data: this.arrayBufferToBase64(log.data), // Convert ArrayBuffer to base64 for JSON
				})),
				stats: this.getStats(),
			}

			const jsonString = JSON.stringify(jsonData, null, 2)
			return new Blob([jsonString], { type: "application/json" })
		} else {
			// CSV format
			const headers = [
				"ID",
				"Timestamp",
				"Type",
				"Direction",
				"MessageType",
				"Size",
				"Sequence",
				"ConnectionId",
				"ProtocolType",
				"IsLastPacket",
			]

			const rows = logs.map((log) => [
				log.id,
				new Date(log.timestamp).toISOString(),
				log.type,
				log.direction,
				log.messageType,
				log.size.toString(),
				log.sequence?.toString() || "",
				log.metadata.connectionId || "",
				log.metadata.protocolType || "",
				log.metadata.isLastPacket?.toString() || "",
			])

			const csvContent = [headers, ...rows]
				.map((row) => row.map((cell) => `"${cell}"`).join(","))
				.join("\n")

			return new Blob([csvContent], { type: "text/csv" })
		}
	}

	/**
	 * Export complete package with logs and audio fragments
	 */
	async exportLogsWithAudioFragments(
		format: "json" | "csv" = "json",
		filter?: PacketLogFilter,
		options: {
			includeAudioFragments?: boolean
			sampleRate?: number
			bitsPerSample?: number
			includeAnalysis?: boolean
		} = {},
	): Promise<Blob> {
		const includeAudioFragments = options.includeAudioFragments ?? true
		const sampleRate = options.sampleRate || 16000
		const bitsPerSample = options.bitsPerSample || 16
		const includeAnalysis = options.includeAnalysis ?? true

		// 按需加载 JSZip
		const JSZip = await loadJSZip()
		const zip = new JSZip()

		// Export logs
		const logsBlob = await this.exportLogs(format, filter)
		const logsFilename = `packet-logs.${format}`
		zip.file(logsFilename, logsBlob)

		// Export audio fragments if requested
		if (includeAudioFragments) {
			try {
				const { fragments } = await this.exportAudioFragments(filter)

				if (fragments.length > 0) {
					logger.log(`[PacketLogger] Found ${fragments.length} audio fragments to export`)

					// Create audio fragments folder
					const audioFolder = zip.folder("audio_fragments")

					// Calculate merged audio info
					const mergedPcmData = this.mergeAudioFragments(fragments)
					const mergedInfo = mergedPcmData
						? {
								mergedFileName: "merged_audio.wav",
								mergedPcmFileName: "merged_audio.pcm",
								mergedSize: mergedPcmData.byteLength,
								mergedDurationSeconds:
									mergedPcmData.byteLength / (sampleRate * (bitsPerSample / 8)),
								mergedSamples: mergedPcmData.byteLength / (bitsPerSample / 8),
							}
						: null

					// Add metadata for audio fragments
					const audioMetadata = {
						exportTimestamp: new Date().toISOString(),
						totalFragments: fragments.length,
						totalSize: fragments.reduce((sum, f) => sum + f.data.byteLength, 0),
						totalDuration: fragments.reduce(
							(sum, f) => sum + (f.metadata.durationMs || 0),
							0,
						),
						audioConfig: {
							sampleRate,
							bitsPerSample,
							channels: 1,
						},
						mergedAudio: mergedInfo,
						fragments: fragments.map((f) => ({
							id: f.id,
							timestamp: new Date(f.timestamp).toISOString(),
							sequence: f.sequence,
							size: f.data.byteLength,
							samples: f.metadata.samples,
							durationMs: f.metadata.durationMs,
							filename: this.generateAudioFilename(f, "wav"),
						})),
					}
					audioFolder?.file("metadata.json", JSON.stringify(audioMetadata, null, 2))

					// Add analysis report if requested
					if (includeAnalysis) {
						const analysisReport = this.generateAudioFragmentsReport(fragments)
						audioFolder?.file("analysis_report.txt", analysisReport)

						const analysisData = this.analyzeAudioFragments(fragments)
						audioFolder?.file(
							"analysis_data.json",
							JSON.stringify(analysisData, null, 2),
						)
					}

					// Convert and add each audio fragment
					for (let i = 0; i < fragments.length; i++) {
						const fragment = fragments[i]
						const filename = this.generateAudioFilename(fragment, "wav")

						try {
							const wavBlob = this.createWavFile(
								fragment.data,
								sampleRate,
								bitsPerSample,
							)
							audioFolder?.file(filename, wavBlob)
						} catch (error) {
							logger.warn(`Failed to create WAV for fragment ${fragment.id}:`, error)
							// Fallback: save raw PCM data
							const rawFilename = this.generateAudioFilename(fragment, "pcm")
							audioFolder?.file(rawFilename, fragment.data)
						}
					}

					// Create merged audio file
					try {
						logger.log("[PacketLogger] Creating merged audio file from all fragments")
						const mergedAudioBlob = await this.createMergedAudioFile(
							fragments,
							sampleRate,
							bitsPerSample,
						)
						if (mergedAudioBlob) {
							audioFolder?.file("merged_audio.wav", mergedAudioBlob)

							// Also create a raw PCM version for debugging
							const mergedPcmData = this.mergeAudioFragments(fragments)
							if (mergedPcmData) {
								audioFolder?.file("merged_audio.pcm", mergedPcmData)
							}

							logger.log(
								`[PacketLogger] Merged audio file created successfully (${(
									mergedAudioBlob.size / 1024
								).toFixed(1)} KB)`,
							)
						}
					} catch (error) {
						logger.warn("[PacketLogger] Failed to create merged audio file:", error)
					}
				} else {
					logger.log("[PacketLogger] No audio fragments found")
				}
			} catch (error) {
				logger.warn("[PacketLogger] Failed to export audio fragments:", error)
			}
		}

		// Add comprehensive analysis report
		if (includeAnalysis) {
			const logs = await this.getAllLogs(filter)
			const comprehensiveReport = await this.generateComprehensiveReport(logs, filter)
			zip.file("comprehensive_analysis.txt", comprehensiveReport)
		}

		// Add export summary
		const exportSummary = {
			exportTimestamp: new Date().toISOString(),
			exportFormat: format,
			filter: filter || "none",
			options,
			contents: {
				packetLogs: true,
				audioFragments: includeAudioFragments,
				analysis: includeAnalysis,
			},
		}
		zip.file("export_summary.json", JSON.stringify(exportSummary, null, 2))

		return zip.generateAsync({ type: "blob" })
	}

	/**
	 * Export audio fragments from packet logs
	 */
	async exportAudioFragments(filter?: PacketLogFilter): Promise<{
		fragments: Array<{
			id: string
			timestamp: number
			sequence?: number
			data: ArrayBuffer
			metadata: {
				samples?: number
				durationMs?: number
				sampleRate?: number
				bitsPerSample?: number
			}
		}>
		totalFragments: number
		totalSize: number
		totalDuration: number
	}> {
		const logs = await this.getAllLogs(filter)

		logger.log("[PacketLogger] Exporting audio fragments", logs)

		// Filter for audio data packets
		const audioLogs = logs.filter(
			(log) =>
				log.type === "sent" &&
				log.messageType === "AUDIO_DATA" &&
				log.metadata.protocolType === "audio" &&
				log.data.byteLength > 0 &&
				!log.metadata.isLastPacket, // Exclude end signal packets
		)

		const fragments = audioLogs.map((log) => {
			// Extract audio data from protocol message
			const audioData = this.extractAudioDataFromProtocolMessage(log.data)

			return {
				id: log.id,
				timestamp: log.timestamp,
				sequence: log.sequence,
				data: audioData,
				metadata: {
					samples: log.metadata.audioStats?.samples,
					durationMs: log.metadata.audioStats?.durationMs,
					sampleRate: 16000, // Default from config
					bitsPerSample: 16, // Default from config
				},
			}
		})

		const totalSize = fragments.reduce((sum, fragment) => sum + fragment.data.byteLength, 0)
		const totalDuration = fragments.reduce(
			(sum, fragment) => sum + (fragment.metadata.durationMs || 0),
			0,
		)

		return {
			fragments,
			totalFragments: fragments.length,
			totalSize,
			totalDuration,
		}
	}

	/**
	 * Export audio fragments as ZIP file containing WAV files
	 */
	async exportAudioFragmentsAsZip(
		filter?: PacketLogFilter,
		options: {
			sampleRate?: number
			bitsPerSample?: number
			includeMetadata?: boolean
		} = {},
	): Promise<Blob> {
		const { fragments } = await this.exportAudioFragments(filter)

		// 按需加载 JSZip
		const JSZip = await loadJSZip()
		const zip = new JSZip()

		const sampleRate = options.sampleRate || 16000
		const bitsPerSample = options.bitsPerSample || 16
		const includeMetadata = options.includeMetadata ?? true

		// Add metadata file if requested
		if (includeMetadata) {
			const metadata = {
				exportTimestamp: new Date().toISOString(),
				totalFragments: fragments.length,
				totalSize: fragments.reduce((sum, f) => sum + f.data.byteLength, 0),
				totalDuration: fragments.reduce((sum, f) => sum + (f.metadata.durationMs || 0), 0),
				audioConfig: {
					sampleRate,
					bitsPerSample,
					channels: 1,
				},
				fragments: fragments.map((f) => ({
					id: f.id,
					timestamp: new Date(f.timestamp).toISOString(),
					sequence: f.sequence,
					size: f.data.byteLength,
					samples: f.metadata.samples,
					durationMs: f.metadata.durationMs,
				})),
			}
			zip.file("metadata.json", JSON.stringify(metadata, null, 2))
		}

		// Convert each fragment to WAV and add to ZIP
		for (let i = 0; i < fragments.length; i++) {
			const fragment = fragments[i]
			const sequenceStr =
				fragment.sequence?.toString().padStart(6, "0") || i.toString().padStart(6, "0")
			const filename = `fragment_${sequenceStr}_${fragment.id.slice(0, 8)}.wav`

			try {
				const wavBlob = this.createWavFile(fragment.data, sampleRate, bitsPerSample)
				zip.file(filename, wavBlob)
			} catch (error) {
				logger.warn(`Failed to create WAV for fragment ${fragment.id}:`, error)
				// Fallback: save raw PCM data
				const rawFilename = `fragment_${sequenceStr}_${fragment.id.slice(0, 8)}.pcm`
				zip.file(rawFilename, fragment.data)
			}
		}

		// Generate ZIP file
		const zipBlob = await zip.generateAsync({ type: "blob" })
		return zipBlob
	}

	/**
	 * Download audio fragments as ZIP file
	 */
	async downloadAudioFragments(
		filename?: string,
		filter?: PacketLogFilter,
		options: {
			sampleRate?: number
			bitsPerSample?: number
			includeMetadata?: boolean
		} = {},
	): Promise<void> {
		const zipBlob = await this.exportAudioFragmentsAsZip(filter, options)

		const defaultFilename = `voice-audio-fragments-${new Date()
			.toISOString()
			.slice(0, 19)
			.replace(/:/g, "-")}.zip`
		const finalFilename = filename || defaultFilename

		// Create download link
		const url = URL.createObjectURL(zipBlob)
		const link = document.createElement("a")
		link.href = url
		link.download = finalFilename
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

		// Clean up
		URL.revokeObjectURL(url)

		logger.log(`[PacketLogger] Downloaded audio fragments as ${finalFilename}`)
	}

	/**
	 * Extract audio data from protocol message
	 */
	private extractAudioDataFromProtocolMessage(messageData: ArrayBuffer): ArrayBuffer {
		// The message format includes protocol headers, we need to extract just the audio payload
		// Based on the protocol structure: [Header][Sequence][Audio Data]

		const headerSize = 16 // Protocol header size
		const sequenceSize = 4 // Sequence number size
		const totalHeaderSize = headerSize + sequenceSize

		if (messageData.byteLength <= totalHeaderSize) {
			return new ArrayBuffer(0)
		}

		// Extract audio payload (skip headers)
		return messageData.slice(totalHeaderSize)
	}

	/**
	 * Create WAV file from PCM audio data
	 */
	private createWavFile(pcmData: ArrayBuffer, sampleRate: number, bitsPerSample: number): Blob {
		const pcmBytes = new Uint8Array(pcmData)
		const channels = 1
		const bytesPerSample = bitsPerSample / 8
		const byteRate = sampleRate * channels * bytesPerSample
		const blockAlign = channels * bytesPerSample
		const dataSize = pcmBytes.length
		const fileSize = 36 + dataSize

		// Create WAV header
		const header = new ArrayBuffer(44)
		const view = new DataView(header)

		// RIFF chunk descriptor
		view.setUint8(0, 0x52) // 'R'
		view.setUint8(1, 0x49) // 'I'
		view.setUint8(2, 0x46) // 'F'
		view.setUint8(3, 0x46) // 'F'
		view.setUint32(4, fileSize, true) // File size
		view.setUint8(8, 0x57) // 'W'
		view.setUint8(9, 0x41) // 'A'
		view.setUint8(10, 0x56) // 'V'
		view.setUint8(11, 0x45) // 'E'

		// fmt sub-chunk
		view.setUint8(12, 0x66) // 'f'
		view.setUint8(13, 0x6d) // 'm'
		view.setUint8(14, 0x74) // 't'
		view.setUint8(15, 0x20) // ' '
		view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
		view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
		view.setUint16(22, channels, true) // NumChannels
		view.setUint32(24, sampleRate, true) // SampleRate
		view.setUint32(28, byteRate, true) // ByteRate
		view.setUint16(32, blockAlign, true) // BlockAlign
		view.setUint16(34, bitsPerSample, true) // BitsPerSample

		// data sub-chunk
		view.setUint8(36, 0x64) // 'd'
		view.setUint8(37, 0x61) // 'a'
		view.setUint8(38, 0x74) // 't'
		view.setUint8(39, 0x61) // 'a'
		view.setUint32(40, dataSize, true) // Subchunk2Size

		// Combine header and PCM data
		const wavFile = new Uint8Array(header.byteLength + pcmBytes.length)
		wavFile.set(new Uint8Array(header), 0)
		wavFile.set(pcmBytes, header.byteLength)

		return new Blob([wavFile], { type: "audio/wav" })
	}

	/**
	 * Generate filename for audio fragment
	 */
	private generateAudioFilename(
		fragment: { sequence?: number; timestamp: number; id: string },
		extension: string,
	): string {
		const sequenceStr = fragment.sequence?.toString().padStart(6, "0") || "000000"
		const timestamp = new Date(fragment.timestamp)
			.toISOString()
			.slice(11, 23)
			.replace(/:/g, "-")
		const idShort = fragment.id.slice(0, 8)
		return `fragment_${sequenceStr}_${timestamp}_${idShort}.${extension}`
	}

	/**
	 * Analyze audio fragments (imported from utils)
	 */
	private analyzeAudioFragments(
		fragments: Array<{
			id: string
			timestamp: number
			sequence?: number
			data: ArrayBuffer
			metadata: {
				samples?: number
				durationMs?: number
				sampleRate?: number
				bitsPerSample?: number
			}
		}>,
	): {
		totalFragments: number
		totalSize: number
		totalDuration: number
		averageFragmentSize: number
		averageFragmentDuration: number
		fragmentSizeDistribution: { small: number; medium: number; large: number }
		continuityScore: number
		qualityMetrics: {
			missingFragments: number[]
			duplicateSequences: number[]
			sizeVariation: number
			timingIrregularities: number
		}
	} {
		if (fragments.length === 0) {
			return {
				totalFragments: 0,
				totalSize: 0,
				totalDuration: 0,
				averageFragmentSize: 0,
				averageFragmentDuration: 0,
				fragmentSizeDistribution: { small: 0, medium: 0, large: 0 },
				continuityScore: 0,
				qualityMetrics: {
					missingFragments: [],
					duplicateSequences: [],
					sizeVariation: 0,
					timingIrregularities: 0,
				},
			}
		}

		const totalFragments = fragments.length
		const totalSize = fragments.reduce((sum, f) => sum + f.data.byteLength, 0)
		const totalDuration = fragments.reduce((sum, f) => sum + (f.metadata.durationMs || 0), 0)
		const averageFragmentSize = totalSize / totalFragments
		const averageFragmentDuration = totalDuration / totalFragments

		// Fragment size distribution
		const sizeDistribution = { small: 0, medium: 0, large: 0 }
		fragments.forEach((fragment) => {
			const size = fragment.data.byteLength
			if (size < 1024) {
				sizeDistribution.small++
			} else if (size <= 8192) {
				sizeDistribution.medium++
			} else {
				sizeDistribution.large++
			}
		})

		// Analyze sequence continuity
		const fragmentsWithSequence = fragments
			.filter((f) => f.sequence !== undefined)
			.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))

		const missingFragments: number[] = []
		const duplicateSequences: number[] = []
		let continuityScore = 100

		if (fragmentsWithSequence.length > 0) {
			const sequenceMap = new Map<number, number>()
			fragmentsWithSequence.forEach((f) => {
				const seq = f.sequence || 0
				const count = sequenceMap.get(seq) || 0
				sequenceMap.set(seq, count + 1)
				if (count > 0) {
					duplicateSequences.push(seq)
				}
			})

			// Check for missing sequences
			const minSeq = fragmentsWithSequence[0].sequence || 0
			const maxSeq = fragmentsWithSequence[fragmentsWithSequence.length - 1].sequence || 0
			for (let seq = minSeq; seq <= maxSeq; seq++) {
				if (!sequenceMap.has(seq)) {
					missingFragments.push(seq)
				}
			}

			// Calculate continuity score
			const expectedFragments = maxSeq - minSeq + 1
			const missingCount = missingFragments.length
			continuityScore = Math.max(0, (1 - missingCount / expectedFragments) * 100)
		}

		// Calculate size variation (coefficient of variation)
		const sizes = fragments.map((f) => f.data.byteLength)
		const meanSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length
		const variance =
			sizes.reduce((sum, size) => sum + Math.pow(size - meanSize, 2), 0) / sizes.length
		const standardDeviation = Math.sqrt(variance)
		const sizeVariation = meanSize > 0 ? (standardDeviation / meanSize) * 100 : 0

		// Analyze timing irregularities
		const sortedFragments = fragments.sort((a, b) => a.timestamp - b.timestamp)
		let timingIrregularities = 0
		for (let i = 1; i < sortedFragments.length; i++) {
			const timeDiff = sortedFragments[i].timestamp - sortedFragments[i - 1].timestamp
			// Consider irregular if gap is > 1 second or < 50ms
			if (timeDiff > 1000 || timeDiff < 50) {
				timingIrregularities++
			}
		}

		return {
			totalFragments,
			totalSize,
			totalDuration,
			averageFragmentSize,
			averageFragmentDuration,
			fragmentSizeDistribution: sizeDistribution,
			continuityScore,
			qualityMetrics: {
				missingFragments,
				duplicateSequences,
				sizeVariation,
				timingIrregularities,
			},
		}
	}

	/**
	 * Generate audio fragments analysis report
	 */
	private generateAudioFragmentsReport(
		fragments: Array<{
			id: string
			timestamp: number
			sequence?: number
			data: ArrayBuffer
			metadata: {
				samples?: number
				durationMs?: number
				sampleRate?: number
				bitsPerSample?: number
			}
		}>,
	): string {
		if (fragments.length === 0) {
			return "No audio fragments available for analysis"
		}

		const analysis = this.analyzeAudioFragments(fragments)
		const startTime = new Date(Math.min(...fragments.map((f) => f.timestamp)))
		const endTime = new Date(Math.max(...fragments.map((f) => f.timestamp)))

		const report = []
		report.push("=== Audio Fragments Analysis Report ===")
		report.push("")
		report.push(`Analysis Period: ${startTime.toISOString()} to ${endTime.toISOString()}`)
		report.push(`Recording Duration: ${(analysis.totalDuration / 1000).toFixed(1)} seconds`)
		report.push("")

		report.push("--- Fragment Statistics ---")
		report.push(`Total Fragments: ${analysis.totalFragments}`)
		report.push(`Total Audio Data: ${this.formatBytes(analysis.totalSize)}`)
		report.push(`Average Fragment Size: ${this.formatBytes(analysis.averageFragmentSize)}`)
		report.push(`Average Fragment Duration: ${analysis.averageFragmentDuration.toFixed(1)}ms`)
		report.push("")

		// Add merged audio information
		const mergedPcmData = this.mergeAudioFragments(fragments)
		if (mergedPcmData) {
			const mergedDurationSeconds = mergedPcmData.byteLength / (16000 * 2) // Assume 16kHz, 16-bit
			report.push("--- Merged Audio File ---")
			report.push(`Merged Audio Size: ${this.formatBytes(mergedPcmData.byteLength)}`)
			report.push(`Merged Duration: ${mergedDurationSeconds.toFixed(2)} seconds`)
			report.push(`Merged Samples: ${Math.floor(mergedPcmData.byteLength / 2)}`)
			report.push("Available as: merged_audio.wav and merged_audio.pcm")
			report.push("")
		}

		report.push("--- Size Distribution ---")
		report.push(`Small fragments (<1KB): ${analysis.fragmentSizeDistribution.small}`)
		report.push(`Medium fragments (1-8KB): ${analysis.fragmentSizeDistribution.medium}`)
		report.push(`Large fragments (>8KB): ${analysis.fragmentSizeDistribution.large}`)
		report.push("")

		report.push(
			`--- Quality Assessment (Continuity Score: ${analysis.continuityScore.toFixed(
				1,
			)}/100) ---`,
		)
		if (analysis.qualityMetrics.missingFragments.length > 0) {
			report.push(
				`Missing fragments detected: ${analysis.qualityMetrics.missingFragments.length} sequences`,
			)
			if (analysis.qualityMetrics.missingFragments.length <= 10) {
				report.push(
					`Missing sequences: ${analysis.qualityMetrics.missingFragments.join(", ")}`,
				)
			}
		}

		if (analysis.qualityMetrics.duplicateSequences.length > 0) {
			report.push(
				`Duplicate fragments detected: ${analysis.qualityMetrics.duplicateSequences.length} sequences`,
			)
		}

		if (analysis.qualityMetrics.sizeVariation > 50) {
			report.push(
				`High size variation detected: ${analysis.qualityMetrics.sizeVariation.toFixed(
					1,
				)}% coefficient of variation`,
			)
		}

		if (analysis.qualityMetrics.timingIrregularities > 0) {
			report.push(
				`Timing irregularities detected: ${analysis.qualityMetrics.timingIrregularities} instances`,
			)
		}

		if (
			analysis.qualityMetrics.missingFragments.length === 0 &&
			analysis.qualityMetrics.duplicateSequences.length === 0 &&
			analysis.qualityMetrics.timingIrregularities === 0
		) {
			report.push("No significant quality issues detected")
		}

		return report.join("\n")
	}

	/**
	 * Generate comprehensive analysis report
	 */
	private async generateComprehensiveReport(
		logs: PacketLogEntry[],
		filter?: PacketLogFilter,
	): Promise<string> {
		const report = []
		report.push("=== Comprehensive Voice Client Analysis Report ===")
		report.push("")
		report.push(`Export Timestamp: ${new Date().toISOString()}`)

		if (filter) {
			report.push(`Applied Filter: ${JSON.stringify(filter, null, 2)}`)
		}
		report.push("")

		// Basic packet statistics
		const totalSize = logs.reduce((sum, log) => sum + log.size, 0)
		const sentPackets = logs.filter((log) => log.type === "sent").length
		const receivedPackets = logs.filter((log) => log.type === "received").length
		const averagePacketSize = totalSize / logs.length || 0

		report.push("--- Packet Statistics ---")
		report.push(`Total Packets: ${logs.length}`)
		report.push(`Sent Packets: ${sentPackets}`)
		report.push(`Received Packets: ${receivedPackets}`)
		report.push(`Total Size: ${this.formatBytes(totalSize)}`)
		report.push(`Average Packet Size: ${this.formatBytes(averagePacketSize)}`)

		const timestamps = logs.map((log) => log.timestamp)
		const timeRange =
			timestamps.length > 0
				? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
				: { start: 0, end: 0 }
		const duration = (timeRange.end - timeRange.start) / 1000
		if (duration > 0) {
			report.push(`Session Duration: ${duration.toFixed(1)} seconds`)
			report.push(`Average Throughput: ${this.formatBytesPerSecond(totalSize / duration)}`)
		}
		report.push("")

		// Message type distribution
		const messageTypes: Record<string, number> = {}
		logs.forEach((log) => {
			messageTypes[log.messageType] = (messageTypes[log.messageType] || 0) + 1
		})

		report.push("--- Message Type Distribution ---")
		Object.entries(messageTypes)
			.sort((a, b) => b[1] - a[1])
			.forEach(([type, count]) => {
				const percentage = ((count / logs.length) * 100).toFixed(1)
				report.push(`  ${type}: ${count} packets (${percentage}%)`)
			})
		report.push("")

		// Audio fragments analysis
		try {
			const { fragments } = await this.exportAudioFragments(filter)
			if (fragments.length > 0) {
				const audioReport = this.generateAudioFragmentsReport(fragments)
				report.push(audioReport)
			} else {
				report.push("--- Audio Fragments ---")
				report.push("No audio fragments found in the session")
			}
		} catch (error) {
			report.push("--- Audio Fragments ---")
			report.push(`Error analyzing audio fragments: ${(error as Error).message}`)
		}

		return report.join("\n")
	}

	/**
	 * Format bytes to human-readable string
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B"

		const k = 1024
		const sizes = ["B", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))

		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
	}

	/**
	 * Format bytes per second to human-readable string
	 */
	private formatBytesPerSecond(bps: number): string {
		return `${this.formatBytes(bps)}/s`
	}

	/**
	 * Merge all audio fragments into a single audio buffer
	 */
	private mergeAudioFragments(
		fragments: Array<{
			id: string
			timestamp: number
			sequence?: number
			data: ArrayBuffer
			metadata: {
				samples?: number
				durationMs?: number
				sampleRate?: number
				bitsPerSample?: number
			}
		}>,
	): ArrayBuffer | null {
		if (fragments.length === 0) {
			return null
		}

		// Sort fragments by sequence number, then by timestamp as fallback
		const sortedFragments = fragments.slice().sort((a, b) => {
			if (a.sequence !== undefined && b.sequence !== undefined) {
				return a.sequence - b.sequence
			}
			return a.timestamp - b.timestamp
		})

		logger.log(`[PacketLogger] Merging ${sortedFragments.length} audio fragments`)

		// Calculate total size
		let totalSize = 0
		const pcmBuffers: Uint8Array[] = []

		for (const fragment of sortedFragments) {
			const audioData = this.extractAudioDataFromProtocolMessage(fragment.data)
			if (audioData.byteLength > 0) {
				const pcmData = new Uint8Array(audioData)
				pcmBuffers.push(pcmData)
				totalSize += pcmData.length
			}
		}

		if (totalSize === 0) {
			logger.warn("[PacketLogger] No valid audio data found in fragments")
			return null
		}

		// Merge all PCM data
		const mergedBuffer = new Uint8Array(totalSize)
		let offset = 0

		for (const pcmData of pcmBuffers) {
			mergedBuffer.set(pcmData, offset)
			offset += pcmData.length
		}

		logger.log(
			`[PacketLogger] Merged audio data: ${totalSize} bytes from ${pcmBuffers.length} valid fragments`,
		)
		return mergedBuffer.buffer
	}

	/**
	 * Create a merged WAV file from all audio fragments
	 */
	private async createMergedAudioFile(
		fragments: Array<{
			id: string
			timestamp: number
			sequence?: number
			data: ArrayBuffer
			metadata: {
				samples?: number
				durationMs?: number
				sampleRate?: number
				bitsPerSample?: number
			}
		}>,
		sampleRate: number,
		bitsPerSample: number,
	): Promise<Blob | null> {
		const mergedPcmData = this.mergeAudioFragments(fragments)
		if (!mergedPcmData) {
			return null
		}

		// Create WAV file from merged PCM data
		const wavBlob = this.createWavFile(mergedPcmData, sampleRate, bitsPerSample)

		// Log merged audio info
		const durationSeconds = (
			mergedPcmData.byteLength /
			(sampleRate * (bitsPerSample / 8))
		).toFixed(2)
		logger.log(
			`[PacketLogger] Created merged WAV file: ${(wavBlob.size / 1024).toFixed(
				1,
			)} KB, ${durationSeconds}s duration`,
		)

		return wavBlob
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const binary = String.fromCharCode(...new Uint8Array(buffer))
		return btoa(binary)
	}

	clearLogs(): void {
		this.logs = []

		if (this.config.enableIndexedDB && this.db) {
			const transaction = this.db.transaction(["packetLogs"], "readwrite")
			const store = transaction.objectStore("packetLogs")
			store.clear()
		}

		logger.log("[PacketLogger] All logs cleared")
	}

	dispose(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = undefined
		}

		// Process any pending batch before disposing
		if (this.pendingBatch.length > 0) {
			this.processBatch()
		}

		if (this.batchTimer) {
			clearTimeout(this.batchTimer)
			this.batchTimer = undefined
		}

		// Clear all operation timeouts
		this.operationTimeouts.forEach((timeout, operationId) => {
			clearTimeout(timeout)
			logger.warn(`[PacketLogger] Clearing timeout for operation: ${operationId}`)
		})
		this.operationTimeouts.clear()

		if (this.db) {
			this.db.close()
			this.db = undefined
		}

		this.logs = []
		this.pendingBatch = []
		logger.log("[PacketLogger] PacketLogger disposed")
	}
}
