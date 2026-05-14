/**
 * useDevConsole
 *
 * Manages the DevTools console state: toggle, entry collection,
 * and error-to-agent forwarding.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import type { JSONContent } from "@tiptap/react"
import i18next from "i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import type {
	ConsoleEntry,
	NetworkEntry,
	ApiCallEntry,
	MessageEntry,
	StorageSnapshot,
	DevConsoleTab,
} from "../components/DevConsole/types"
import { DEVTOOLS_MSG } from "../components/DevConsole/types"

const MAX_CONSOLE_ENTRIES = 2000
const MAX_NETWORK_ENTRIES = 500
const MAX_API_CALL_ENTRIES = 500
const MAX_MESSAGE_ENTRIES = 1000

interface UseDevConsoleOptions {
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	fileId?: string
	relativeFilePath?: string
}

interface UseDevConsoleReturn {
	enabled: boolean
	toggle: () => void
	consoleEntries: ConsoleEntry[]
	networkEntries: NetworkEntry[]
	apiCallEntries: ApiCallEntry[]
	messageEntries: MessageEntry[]
	storageSnapshot: StorageSnapshot | null
	storageLoading: boolean
	activeTab: DevConsoleTab
	setActiveTab: (tab: DevConsoleTab) => void
	clearConsole: () => void
	clearNetwork: () => void
	clearApiCalls: () => void
	clearMessages: () => void
	clearAll: () => void
	sendErrorToAgent: (entry: ConsoleEntry | NetworkEntry) => void
	executeCode: (code: string) => void
	requestCompletions: (expression: string) => Promise<string[]>
	requestStorageSnapshot: () => void
	consoleErrorCount: number
	networkErrorCount: number
	apiCallErrorCount: number
}

export function useDevConsole({
	iframeRef,
	fileId,
	relativeFilePath,
}: UseDevConsoleOptions): UseDevConsoleReturn {
	const [enabled, setEnabled] = useState(false)
	const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
	const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([])
	const [apiCallEntries, setApiCallEntries] = useState<ApiCallEntry[]>([])
	const [messageEntries, setMessageEntries] = useState<MessageEntry[]>([])
	const [storageSnapshot, setStorageSnapshot] = useState<StorageSnapshot | null>(null)
	const [storageLoading, setStorageLoading] = useState(false)
	const [activeTab, setActiveTab] = useState<DevConsoleTab>("console")

	// Keep refs for the latest entries to avoid stale closures in message listener
	const consoleEntriesRef = useRef(consoleEntries)
	consoleEntriesRef.current = consoleEntries
	const networkEntriesRef = useRef(networkEntries)
	networkEntriesRef.current = networkEntries
	// Track enabled state in ref for re-enable on iframe refresh
	const enabledRef = useRef(enabled)
	enabledRef.current = enabled

	// Toggle devtools on/off
	const toggle = useCallback(() => {
		const nextEnabled = !enabled
		setEnabled(nextEnabled)

		if (!nextEnabled) {
			// Clear state when disabling
			setConsoleEntries([])
			setNetworkEntries([])
			setApiCallEntries([])
			setMessageEntries([])
		}

		// Send toggle command to iframe
		iframeRef.current?.contentWindow?.postMessage(
			{ type: DEVTOOLS_MSG.TOGGLE, enabled: nextEnabled, timestamp: Date.now() },
			"*",
		)
	}, [enabled, iframeRef])

	// Clear functions
	const clearConsole = useCallback(() => {
		setConsoleEntries([])
	}, [])

	const clearNetwork = useCallback(() => {
		setNetworkEntries([])
	}, [])

	const clearApiCalls = useCallback(() => {
		setApiCallEntries([])
	}, [])

	const clearMessages = useCallback(() => {
		setMessageEntries([])
	}, [])

	// Request storage snapshot from iframe
	const requestStorageSnapshot = useCallback(() => {
		setStorageLoading(true)
		iframeRef.current?.contentWindow?.postMessage(
			{ type: DEVTOOLS_MSG.STORAGE_REQUEST, timestamp: Date.now() },
			"*",
		)
		// Timeout fallback in case iframe doesn't respond
		setTimeout(() => setStorageLoading(false), 5000)
	}, [iframeRef])

	const clearAll = useCallback(() => {
		setConsoleEntries([])
		setNetworkEntries([])
		setApiCallEntries([])
		setMessageEntries([])
		// Notify iframe to clear its buffers too
		iframeRef.current?.contentWindow?.postMessage(
			{ type: DEVTOOLS_MSG.CLEAR, timestamp: Date.now() },
			"*",
		)
	}, [iframeRef])

	// Send an error entry to the Agent via setInputMessage
	const sendErrorToAgent = useCallback(
		(entry: ConsoleEntry | NetworkEntry) => {
			const t = (key: string) => i18next.t(`super:stylePanel.devConsole.${key}`)

			let lines: string[]

			if ("level" in entry) {
				const errorType =
					entry.source === "uncaughtError"
						? t("errorTypeUncaught")
						: entry.source === "unhandledRejection"
							? t("errorTypeUnhandledRejection")
							: t("errorTypeConsole")

				const time = new Date(entry.timestamp).toLocaleString()
				const argsText = entry.args.join(" ")

				lines = [
					t("agentRuntimeErrorTitle"),
					"",
					`${t("agentErrorType")}: ${errorType}`,
					`${t("agentErrorMessage")}: ${argsText}`,
					...(entry.stack ? [`${t("agentErrorStack")}:`, entry.stack] : []),
					"",
					`${t("agentErrorTime")}: ${time}`,
					"",
					t("agentErrorFixPrompt"),
				]
			} else {
				const time = new Date(entry.startTime).toLocaleString()

				lines = [
					t("agentNetworkErrorTitle"),
					"",
					`${t("agentErrorRequest")}: ${entry.method} ${entry.url}`,
					`${t("agentErrorStatus")}: ${entry.status} ${entry.statusText || entry.error || ""}`,
					`${t("agentErrorDuration")}: ${entry.duration}ms`,
					...(entry.requestBody
						? [`${t("agentErrorRequestBody")}:`, entry.requestBody.slice(0, 500)]
						: []),
					...(entry.responseBody
						? [`${t("agentErrorResponseBody")}:`, entry.responseBody.slice(0, 1000)]
						: []),
					"",
					`${t("agentErrorTime")}: ${time}`,
					"",
					t("agentNetworkFixPrompt"),
				]
			}

			// Build inline nodes: text lines + file mention
			const inlineNodes: JSONContent[] = []
			lines.forEach((line, i) => {
				if (i > 0) inlineNodes.push({ type: "hardBreak" })
				if (line) inlineNodes.push({ type: "text", text: line })
			})

			// Append file mention if file context is available
			if (fileId && relativeFilePath) {
				const fileName = relativeFilePath.split("/").pop() || relativeFilePath
				const fileExt = fileName.includes(".") ? fileName.split(".").pop() || "" : ""
				inlineNodes.push({ type: "hardBreak" })
				inlineNodes.push({
					type: "mention",
					attrs: {
						type: MentionItemType.PROJECT_FILE,
						data: {
							file_id: fileId,
							file_name: fileName,
							file_path: relativeFilePath,
							file_extension: fileExt,
						} satisfies ProjectFileMentionData,
					},
				})
			}

			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: inlineNodes }],
			}
			pubsub.publish(PubSubEvents.Set_Input_Message, content)
		},
		[fileId, relativeFilePath],
	)

	// Re-enable DevTools when iframe-runtime restarts (content refresh).
	// The iframe-runtime sends MAGIC_DEVTOOLS_RUNTIME_READY on bootstrap.
	// If DevTools was enabled, we re-send the TOGGLE command to the new runtime.
	// Also listen for "contentLoaded" which indicates document.write completed.
	useEffect(() => {
		const resendToggle = () => {
			if (!enabledRef.current) return
			// Small delay to ensure iframe-runtime has finished bootstrapping
			setTimeout(() => {
				iframeRef.current?.contentWindow?.postMessage(
					{ type: DEVTOOLS_MSG.TOGGLE, enabled: true, timestamp: Date.now() },
					"*",
				)
			}, 100)
		}

		const handleMessage = (event: MessageEvent) => {
			const type = event.data?.type
			if (type === "MAGIC_DEVTOOLS_RUNTIME_READY" || type === "contentLoaded") {
				// Accept from any source matching our iframe (cross-origin safe)
				if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
					resendToggle()
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [iframeRef])

	// Listen for devtools messages from iframe
	useEffect(() => {
		if (!enabled) return

		const handleMessage = (event: MessageEvent) => {
			if (event.source !== iframeRef.current?.contentWindow) return
			if (!event.data?.type) return

			switch (event.data.type) {
				case DEVTOOLS_MSG.CONSOLE_ENTRY: {
					const entry = event.data.payload as ConsoleEntry
					if (entry?.id) {
						setConsoleEntries((prev) => {
							const next = [...prev, entry]
							return next.length > MAX_CONSOLE_ENTRIES
								? next.slice(next.length - MAX_CONSOLE_ENTRIES)
								: next
						})
					}
					break
				}
				case DEVTOOLS_MSG.NETWORK_ENTRY: {
					const entry = event.data.payload as NetworkEntry
					if (entry?.id) {
						setNetworkEntries((prev) => {
							const next = [...prev, entry]
							return next.length > MAX_NETWORK_ENTRIES
								? next.slice(next.length - MAX_NETWORK_ENTRIES)
								: next
						})
					}
					break
				}
				case DEVTOOLS_MSG.API_CALL_ENTRY: {
					const entry = event.data.payload as ApiCallEntry
					if (entry?.id) {
						setApiCallEntries((prev) => {
							// If entry has a matching requestId, update existing pending entry
							const requestId = entry.details?.requestId as string | undefined
							if (
								requestId &&
								entry.status !== "pending" &&
								prev.some(
									(e) =>
										e.details?.requestId === requestId &&
										e.status === "pending",
								)
							) {
								return prev.map((e) =>
									e.details?.requestId === requestId && e.status === "pending"
										? entry
										: e,
								)
							}
							const next = [...prev, entry]
							return next.length > MAX_API_CALL_ENTRIES
								? next.slice(next.length - MAX_API_CALL_ENTRIES)
								: next
						})
					}
					break
				}
				case DEVTOOLS_MSG.MESSAGE_ENTRY: {
					const entry = event.data.payload as MessageEntry
					if (entry?.id) {
						setMessageEntries((prev) => {
							const next = [...prev, entry]
							return next.length > MAX_MESSAGE_ENTRIES
								? next.slice(next.length - MAX_MESSAGE_ENTRIES)
								: next
						})
					}
					break
				}
				case DEVTOOLS_MSG.SNAPSHOT: {
					const payload = event.data.payload as {
						consoleEntries?: ConsoleEntry[]
						networkEntries?: NetworkEntry[]
						apiCallEntries?: ApiCallEntry[]
						messageEntries?: MessageEntry[]
					}
					if (payload?.consoleEntries) {
						setConsoleEntries(payload.consoleEntries)
					}
					if (payload?.networkEntries) {
						setNetworkEntries(payload.networkEntries)
					}
					if (payload?.apiCallEntries) {
						setApiCallEntries(payload.apiCallEntries)
					}
					if (payload?.messageEntries) {
						setMessageEntries(payload.messageEntries)
					}
					break
				}
				case DEVTOOLS_MSG.STORAGE_SNAPSHOT: {
					const snapshot = event.data.payload as StorageSnapshot
					if (snapshot) {
						setStorageSnapshot(snapshot)
						setStorageLoading(false)
					}
					break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [enabled, iframeRef])

	// Execute code in iframe context
	const executeCode = useCallback(
		(code: string) => {
			if (!code.trim()) return
			const evalId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

			// Add input entry (source: "eval-input")
			const inputEntry: ConsoleEntry = {
				id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				level: "log",
				args: [`> ${code}`],
				timestamp: Date.now(),
				source: "eval-input",
			}
			setConsoleEntries((prev) => {
				const next = [...prev, inputEntry]
				return next.length > MAX_CONSOLE_ENTRIES
					? next.slice(next.length - MAX_CONSOLE_ENTRIES)
					: next
			})

			// Listen for eval result
			const handleResult = (event: MessageEvent) => {
				if (event.source !== iframeRef.current?.contentWindow) return
				if (event.data?.type !== DEVTOOLS_MSG.EVAL_RESULT) return
				if (event.data.evalId !== evalId) return
				window.removeEventListener("message", handleResult)

				const resultEntry: ConsoleEntry = {
					id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					level: event.data.isError ? "error" : "log",
					args: [`< ${event.data.result ?? "undefined"}`],
					timestamp: Date.now(),
					source: "eval-result",
					structuredResult: event.data.structured ?? undefined,
				}
				setConsoleEntries((prev) => {
					const next = [...prev, resultEntry]
					return next.length > MAX_CONSOLE_ENTRIES
						? next.slice(next.length - MAX_CONSOLE_ENTRIES)
						: next
				})
			}
			window.addEventListener("message", handleResult)

			// Send eval command to iframe
			iframeRef.current?.contentWindow?.postMessage(
				{ type: DEVTOOLS_MSG.EVAL, code, evalId, timestamp: Date.now() },
				"*",
			)

			// Timeout cleanup (10s)
			setTimeout(() => {
				window.removeEventListener("message", handleResult)
			}, 10000)
		},
		[iframeRef],
	)

	// Request completions from iframe for autocomplete
	const requestCompletions = useCallback(
		(expression: string): Promise<string[]> => {
			return new Promise((resolve) => {
				const requestId = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

				const handleResult = (event: MessageEvent) => {
					if (event.source !== iframeRef.current?.contentWindow) return
					if (event.data?.type !== DEVTOOLS_MSG.EVAL_COMPLETIONS_RESULT) return
					if (event.data.requestId !== requestId) return
					window.removeEventListener("message", handleResult)
					resolve(event.data.completions ?? [])
				}
				window.addEventListener("message", handleResult)

				iframeRef.current?.contentWindow?.postMessage(
					{
						type: DEVTOOLS_MSG.EVAL_COMPLETIONS,
						expression,
						requestId,
						timestamp: Date.now(),
					},
					"*",
				)

				// Timeout: resolve empty after 2s
				setTimeout(() => {
					window.removeEventListener("message", handleResult)
					resolve([])
				}, 2000)
			})
		},
		[iframeRef],
	)

	// Compute error counts
	const consoleErrorCount = consoleEntries.filter((e) => e.level === "error").length
	const networkErrorCount = networkEntries.filter(
		(e) => e.error || e.status >= 400 || e.status === 0,
	).length
	const apiCallErrorCount = apiCallEntries.filter(
		(e) => e.status === "error" || e.status === "timeout",
	).length

	return {
		enabled,
		toggle,
		consoleEntries,
		networkEntries,
		apiCallEntries,
		messageEntries,
		storageSnapshot,
		storageLoading,
		activeTab,
		setActiveTab,
		clearConsole,
		clearNetwork,
		clearApiCalls,
		clearMessages,
		clearAll,
		sendErrorToAgent,
		executeCode,
		requestCompletions,
		requestStorageSnapshot,
		consoleErrorCount,
		networkErrorCount,
		apiCallErrorCount,
	}
}
