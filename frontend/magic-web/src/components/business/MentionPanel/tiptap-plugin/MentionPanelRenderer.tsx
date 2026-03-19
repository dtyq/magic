import { useState, useRef, useEffect, useImperativeHandle, forwardRef, lazy, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"

// Types
import type {
	MentionPanelRendererProps,
	MentionPanelRendererRef,
	MentionSelectHandler,
} from "./types"
import type { SuggestionKeyDownProps } from "@tiptap/suggestion"
import type { MentionItem } from "../types"
import { PanelState } from "../types"

// Components
const MentionPanel = lazy(() => import("../index"))

// Hooks
import { useI18nStatic } from "../hooks/useI18n"

/**
 * MentionPanelRenderer - Bridge component between Tiptap and MentionPanel
 *
 * Handles the integration between Tiptap's suggestion system and our MentionPanel component
 *
 * @param props - Renderer props from Tiptap suggestion
 * @param ref - Ref for external control
 * @returns JSX.Element
 */
const MentionPanelRenderer = observer(
	forwardRef<MentionPanelRendererRef, MentionPanelRendererProps>((props, ref) => {
		const {
			query,
			decorationNode,
			language = "en",
			onSelect,
			onExit,
			disableKeyboardShortcuts = false,
			dataService,
		} = props

		// Panel ref for positioning
		const panelRef = useRef<HTMLDivElement>(null)

		// Use decoration node directly as trigger element
		const triggerElement = decorationNode as HTMLElement | null

		// Internationalization
		const t = useI18nStatic(language)

		// Determine panel state based on query
		const panelState = query.trim() ? PanelState.SEARCH : PanelState.DEFAULT

		// Handle search query changes
		const [lastQuery, setLastQuery] = useState("")

		// Trigger search when query changes and we're in search mode
		useEffect(() => {
			if (query !== lastQuery) {
				setLastQuery(query)
				// The search will be handled by the MentionPanel component
				// when it receives the new initialState and query
			}
		}, [query, lastQuery])

		// Handle item selection
		const handleSelect: MentionSelectHandler = useMemoizedFn((item: MentionItem) => {
			onSelect(item)
			// Panel will be destroyed by Tiptap suggestion system
		})

		// Handle panel close
		const handleClose = useMemoizedFn(() => {
			onExit()
			// Panel will be destroyed by Tiptap suggestion system
		})

		// Handle keyboard navigation
		const handleKeyDown = useMemoizedFn((props: SuggestionKeyDownProps): boolean => {
			// Let MentionPanel handle keyboard events first
			// If it doesn't handle the event, return false to let Tiptap handle it
			const { event } = props

			// Handle escape key
			if (event.key === "Escape") {
				handleClose()
				return true
			}

			// For other keys, the MentionPanel's internal keyboard handling will take care of it
			// through its own event listeners
			return false
		})

		// Expose methods to parent component
		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: handleKeyDown,
				panelRef,
				isVisible: true, // Always visible when component exists
			}),
			[handleKeyDown],
		)

		// Create a mutable ref object for the trigger element
		const triggerRefObject = { current: triggerElement }

		// Component is only created when needed, so always render
		return (
			<div ref={panelRef}>
				<Suspense fallback={null}>
					<MentionPanel
						visible={!disableKeyboardShortcuts}
						initialState={panelState}
						onSelect={handleSelect}
						onClose={handleClose}
						searchPlaceholder={t.searchPlaceholder}
						triggerRef={triggerRefObject}
						language={language}
						disableKeyboardShortcuts={disableKeyboardShortcuts}
						dataService={dataService}
					/>
				</Suspense>
			</div>
		)
	}),
)

MentionPanelRenderer.displayName = "MentionPanelRenderer"

export default MentionPanelRenderer
