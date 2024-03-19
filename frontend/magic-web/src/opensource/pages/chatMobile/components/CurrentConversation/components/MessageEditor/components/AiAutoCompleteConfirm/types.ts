import type { CSSProperties } from "react"

// Base component props
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	suggestionTextClassName?: string
}

// AI Auto Complete Confirm component props
export interface AiAutoCompleteConfirmProps extends BaseComponentProps {
	/** The original text that user typed */
	originalText: string
	/** The suggested completion text */
	suggestedText: string
	/** Callback when user accepts the suggestion */
	onAccept?: () => void
	/** Callback when user rejects the suggestion */
	onReject?: () => void
	/** Whether the component is loading */
	loading?: boolean
}

// Component state interface
export interface AiAutoCompleteState {
	isVisible: boolean
	isAccepting: boolean
}

// Event handler types
export type AcceptHandler = () => void | Promise<void>
export type RejectHandler = () => void | Promise<void>
