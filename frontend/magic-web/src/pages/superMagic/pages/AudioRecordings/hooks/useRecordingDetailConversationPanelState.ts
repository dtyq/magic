import { useCallback, useRef, useState, type RefObject } from "react"
import { reportCaughtStorageFailure } from "@/app/services/storage/storageFailure"
import { platformKey } from "@/utils/storage"
import {
	RECORDING_CHAT_EXPANDED_WIDTH,
	RECORDING_CHAT_MAX_WIDTH,
	RECORDING_CHAT_MIN_WIDTH,
} from "../components/recording-detail/recording-detail-layout"

/**
 * Stores one desktop recording-detail conversation preference for all recordings.
 * The payload is `{ collapsed, width }` so expand/collapse and the dragged width share one key.
 */
export const RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY = platformKey(
	"audio-recording-detail-conversation-panel-collapsed",
)

/** Product key reported on storage failure; never include the stored payload. */
const CONVERSATION_PANEL_STORAGE_KEY_NAME = "audio-recording-detail-conversation-panel-collapsed"

/** First visit stays on the narrow rail until the user expands it. */
const DEFAULT_CONVERSATION_PANEL_COLLAPSED = true

interface ConversationPanelPersistedState {
	collapsed: boolean
	width: number
}

/** Clamps a raw conversation-surface width into the 320–560 band. */
function clampConversationWidth(width: number): number {
	return Math.max(RECORDING_CHAT_MIN_WIDTH, Math.min(RECORDING_CHAT_MAX_WIDTH, width))
}

/** Reads the persisted preference, including the legacy boolean string, and falls back to collapsed. */
function readConversationPanelState(): ConversationPanelPersistedState {
	const fallback: ConversationPanelPersistedState = {
		collapsed: DEFAULT_CONVERSATION_PANEL_COLLAPSED,
		width: RECORDING_CHAT_EXPANDED_WIDTH,
	}

	if (typeof window === "undefined") return fallback

	try {
		const storedValue = window.localStorage.getItem(
			RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
		)
		if (storedValue === null) return fallback

		// Older builds stored only "true" / "false". Keep that collapsed flag and use the default width.
		if (storedValue === "true") return { ...fallback, collapsed: true }
		if (storedValue === "false") return { ...fallback, collapsed: false }

		const parsed = JSON.parse(storedValue) as Partial<ConversationPanelPersistedState>
		return {
			collapsed: parsed.collapsed === true,
			width: clampConversationWidth(
				typeof parsed.width === "number" && Number.isFinite(parsed.width)
					? parsed.width
					: RECORDING_CHAT_EXPANDED_WIDTH,
			),
		}
	} catch (error) {
		// Restricted webviews can reject localStorage access; preserve the default UI state.
		reportCaughtStorageFailure({
			eventKey: "recording_conversation_panel_preference_read_failed",
			error,
			message: "Failed to read recording conversation panel preference",
			key: CONVERSATION_PANEL_STORAGE_KEY_NAME,
		})
		return fallback
	}
}

/** Persists collapsed + width without letting storage errors interrupt the UI update. */
function persistConversationPanelState(state: ConversationPanelPersistedState): void {
	if (typeof window === "undefined") return

	try {
		window.localStorage.setItem(
			RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
			JSON.stringify({
				collapsed: state.collapsed,
				width: clampConversationWidth(state.width),
			}),
		)
	} catch (error) {
		// Quota limits and private browsing restrictions should not block panel interaction.
		reportCaughtStorageFailure({
			eventKey: "recording_conversation_panel_preference_write_failed",
			error,
			message: "Failed to write recording conversation panel preference",
			key: CONVERSATION_PANEL_STORAGE_KEY_NAME,
		})
	}
}

interface UseRecordingDetailConversationPanelStateResult {
	isConversationPanelCollapsed: boolean
	conversationPanelWidth: number
	/** Attach to the conversation rail so the handle can preview drag width on the DOM. */
	conversationPanelRef: RefObject<HTMLDivElement | null>
	toggleConversationPanel: () => void
	expandConversationPanel: () => void
	collapseConversationPanel: () => void
	setConversationPanelWidth: (width: number) => void
}

/**
 * Owns only the persisted conversation-rail state (collapsed + width). The drag lifecycle lives in
 * `RecordingConversationPanelDragStore`, so this page-level hook never re-renders during a drag.
 */
export function useRecordingDetailConversationPanelState(): UseRecordingDetailConversationPanelStateResult {
	const [state, setState] = useState<ConversationPanelPersistedState>(readConversationPanelState)
	const conversationPanelRef = useRef<HTMLDivElement | null>(null)

	/** Applies one preference transition and persists the result against the latest committed value. */
	const applyState = useCallback(
		(
			updater: (current: ConversationPanelPersistedState) => ConversationPanelPersistedState,
		) => {
			setState((current) => {
				const next = updater(current)
				persistConversationPanelState(next)
				return next
			})
		},
		[],
	)

	/** Toggles the rail and saves the user's latest layout preference without resetting width. */
	const toggleConversationPanel = useCallback(() => {
		applyState((current) => ({ ...current, collapsed: !current.collapsed }))
	}, [applyState])

	/** Expands the narrow rail back to the last conversation width. */
	const expandConversationPanel = useCallback(() => {
		applyState((current) => ({ ...current, collapsed: false }))
	}, [applyState])

	/** Collapses the rail while preserving the current conversation width for the next expand. */
	const collapseConversationPanel = useCallback(() => {
		applyState((current) => ({ ...current, collapsed: true }))
	}, [applyState])

	/** Commits a newly dragged conversation width and persists it inside the 320–560 band. */
	const setConversationPanelWidth = useCallback(
		(width: number) => {
			applyState((current) => ({ ...current, width: clampConversationWidth(width) }))
		},
		[applyState],
	)

	return {
		isConversationPanelCollapsed: state.collapsed,
		conversationPanelWidth: state.width,
		conversationPanelRef,
		toggleConversationPanel,
		expandConversationPanel,
		collapseConversationPanel,
		setConversationPanelWidth,
	}
}
