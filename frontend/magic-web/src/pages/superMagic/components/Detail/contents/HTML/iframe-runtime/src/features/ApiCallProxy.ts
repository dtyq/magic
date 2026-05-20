/**
 * ApiCallProxy
 *
 * Hooks into MagicApiLogger to intercept structured API call lifecycle events
 * (start → success/failure/timeout) and collects them as ApiCallEntry records.
 * Correlates start/end events by requestId to compute duration and status.
 */

import { MagicApiLogger } from "../magic-api/MagicApiLogger"

export type ApiCallStatus = "pending" | "success" | "error" | "timeout"

export interface ApiCallEntry {
	id: string
	api: string
	event: string
	details?: Record<string, unknown>
	status: ApiCallStatus
	startTime: number
	endTime?: number
	duration?: number
	error?: string
}

type ApiCallEntryListener = (entry: ApiCallEntry) => void

const MAX_ENTRIES = 500

export class ApiCallProxy {
	private enabled = false
	private entries: ApiCallEntry[] = []
	private listener: ApiCallEntryListener | null = null
	/** In-flight calls keyed by requestId */
	private pendingCalls = new Map<string, ApiCallEntry>()

	enable(): void {
		if (this.enabled) return
		this.enabled = true
		MagicApiLogger.onLog = (level, api, event, details) => {
			this.handleLog(level, api, event, details)
		}
	}

	disable(): void {
		if (!this.enabled) return
		this.enabled = false
		MagicApiLogger.onLog = null
	}

	destroy(): void {
		this.disable()
		this.entries = []
		this.pendingCalls.clear()
	}

	onEntry(listener: ApiCallEntryListener): void {
		this.listener = listener
	}

	getEntries(): ApiCallEntry[] {
		return [...this.entries]
	}

	clear(): void {
		this.entries = []
		this.pendingCalls.clear()
	}

	private handleLog(
		_level: string,
		api: string,
		event: string,
		details?: Record<string, unknown>,
	): void {
		const requestId = details?.requestId as string | undefined

		if (event === "request:start" && requestId) {
			const entry: ApiCallEntry = {
				id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				api,
				event,
				details: details ? { ...details } : undefined,
				status: "pending",
				startTime: Date.now(),
			}
			this.pendingCalls.set(requestId, entry)
			this.pushEntry(entry)
			return
		}

		if (
			(event === "request:success" ||
				event === "request:failure" ||
				event === "request:timeout") &&
			requestId
		) {
			const pending = this.pendingCalls.get(requestId)
			if (pending) {
				const endTime = Date.now()
				pending.endTime = endTime
				pending.duration = endTime - pending.startTime
				pending.status =
					event === "request:success"
						? "success"
						: event === "request:timeout"
							? "timeout"
							: "error"
				pending.event = event
				if (details?.error) {
					pending.error = String(details.error)
				}
				// Merge any new details
				if (details) {
					pending.details = { ...pending.details, ...details }
				}
				this.pendingCalls.delete(requestId)
				// Notify listener with updated entry
				this.listener?.(pending)
			} else {
				// No matching start — create a standalone entry
				const entry: ApiCallEntry = {
					id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					api,
					event,
					details: details ? { ...details } : undefined,
					status:
						event === "request:success"
							? "success"
							: event === "request:timeout"
								? "timeout"
								: "error",
					startTime: Date.now(),
					endTime: Date.now(),
					duration: 0,
					error: details?.error ? String(details.error) : undefined,
				}
				this.pushEntry(entry)
			}
			return
		}

		// Non-request events (e.g. fire-and-forget APIs) — log as standalone
		const entry: ApiCallEntry = {
			id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			api,
			event,
			details: details ? { ...details } : undefined,
			status: "success",
			startTime: Date.now(),
			endTime: Date.now(),
			duration: 0,
		}
		this.pushEntry(entry)
	}

	private pushEntry(entry: ApiCallEntry): void {
		this.entries.push(entry)
		if (this.entries.length > MAX_ENTRIES) {
			this.entries = this.entries.slice(-MAX_ENTRIES)
		}
		this.listener?.(entry)
	}
}
