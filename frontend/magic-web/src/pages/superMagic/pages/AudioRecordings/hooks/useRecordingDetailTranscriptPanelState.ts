import { useCallback, useRef, useState, type RefObject } from "react"
import { platformKey } from "@/utils/storage"
import {
	RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
} from "../components/recording-detail/recording-detail-layout"

/**
 * Stores one desktop recording-detail transcript-column preference for all recordings
 * and all three detail hosts (project / folder / share), so a single toggle affects them all.
 * The persisted payload holds both the collapsed flag and the user's last expanded width.
 */
export const RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY = platformKey(
	"audio-recording-detail-transcript-panel-collapsed",
)

/** Starts expanded at the default width, which sits inside the draggable band. */
const DEFAULT_TRANSCRIPT_PANEL_COLLAPSED = false

interface TranscriptPanelPersistedState {
	collapsed: boolean
	width: number
}

/** Clamps a raw width into the readable transcript band. */
function clampTranscriptWidth(width: number): number {
	return Math.max(
		RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
		Math.min(RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH, width),
	)
}

/** Reads the persisted preference and falls back to expanded at the default width on any failure. */
function readTranscriptPanelState(): TranscriptPanelPersistedState {
	const fallback: TranscriptPanelPersistedState = {
		collapsed: DEFAULT_TRANSCRIPT_PANEL_COLLAPSED,
		width: RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	}

	if (typeof window === "undefined") return fallback

	try {
		const storedValue = window.localStorage.getItem(
			RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY,
		)
		if (storedValue === null) return fallback

		// Legacy boolean payloads only encoded the collapsed flag; keep reading them losslessly.
		if (storedValue === "true") return { ...fallback, collapsed: true }
		if (storedValue === "false") return { ...fallback, collapsed: false }

		const parsed = JSON.parse(storedValue) as Partial<TranscriptPanelPersistedState>
		return {
			collapsed: parsed.collapsed === true,
			width: clampTranscriptWidth(
				typeof parsed.width === "number" && Number.isFinite(parsed.width)
					? parsed.width
					: RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
			),
		}
	} catch {
		// Restricted webviews can reject localStorage access; preserve the default UI state.
		return fallback
	}
}

/** Persists the preference without letting storage errors interrupt the UI update. */
function persistTranscriptPanelState(state: TranscriptPanelPersistedState): void {
	if (typeof window === "undefined") return

	try {
		window.localStorage.setItem(
			RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY,
			JSON.stringify(state),
		)
	} catch {
		// Quota limits and private browsing restrictions should not block panel interaction.
	}
}

interface UseRecordingDetailTranscriptPanelStateResult {
	isTranscriptPanelCollapsed: boolean
	transcriptPanelWidth: number
	/** Attach to the workbench grid element so the handle can preview drag width imperatively. */
	workbenchGridRef: RefObject<HTMLDivElement | null>
	expandTranscriptPanel: () => void
	collapseTranscriptPanel: () => void
	setTranscriptPanelWidth: (width: number) => void
}

/**
 * Owns only the persisted transcript-column state (collapsed + width). The drag lifecycle lives in
 * `RecordingTranscriptPanelDragStore`, whose observable visuals only the resize handle subscribes to,
 * so this page-level hook (and its parent) never re-render during a drag.
 */
export function useRecordingDetailTranscriptPanelState(): UseRecordingDetailTranscriptPanelStateResult {
	const [state, setState] = useState<TranscriptPanelPersistedState>(readTranscriptPanelState)
	const workbenchGridRef = useRef<HTMLDivElement | null>(null)

	/** Applies a transition and persists the result; the updater sees the latest committed value. */
	const applyState = useCallback(
		(updater: (current: TranscriptPanelPersistedState) => TranscriptPanelPersistedState) => {
			setState((current) => {
				const next = updater(current)
				persistTranscriptPanelState(next)
				return next
			})
		},
		[],
	)

	/** Expands the column back to its last width and persists the explicit user preference. */
	const expandTranscriptPanel = useCallback(() => {
		applyState((current) => ({ ...current, collapsed: false }))
	}, [applyState])

	/** Collapses the column while preserving the current width for the next expand. */
	const collapseTranscriptPanel = useCallback(() => {
		applyState((current) => ({ ...current, collapsed: true }))
	}, [applyState])

	/** Commits a newly dragged width and persists it. */
	const setTranscriptPanelWidth = useCallback(
		(width: number) => {
			applyState((current) => ({ ...current, width: clampTranscriptWidth(width) }))
		},
		[applyState],
	)

	return {
		isTranscriptPanelCollapsed: state.collapsed,
		transcriptPanelWidth: state.width,
		workbenchGridRef,
		expandTranscriptPanel,
		collapseTranscriptPanel,
		setTranscriptPanelWidth,
	}
}
