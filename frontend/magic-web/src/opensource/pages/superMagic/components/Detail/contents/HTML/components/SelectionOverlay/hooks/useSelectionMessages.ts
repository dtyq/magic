import { useEffect, useRef } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { SelectedInfo } from "../types"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"

interface UseSelectionMessagesProps {
	iframeRef: React.RefObject<HTMLIFrameElement>
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	selectedInfoList: SelectedInfo[]
	setSelectedInfoList: React.Dispatch<React.SetStateAction<SelectedInfo[]>>
	setHoveredRect: React.Dispatch<React.SetStateAction<any>>
	setIsSelectionMode: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Handle messages from iframe for element selection
 */
export function useSelectionMessages({
	iframeRef,
	editorRef,
	selectedInfoList,
	setSelectedInfoList,
	setHoveredRect,
	setIsSelectionMode,
}: UseSelectionMessagesProps) {
	const stylePanelStore = useStylePanelStore()
	// Use ref to track current selected elements without causing effect re-registration
	const selectedInfoListRef = useRef<SelectedInfo[]>(selectedInfoList)
	selectedInfoListRef.current = selectedInfoList

	useEffect(() => {
		const handleMessage = async (event: MessageEvent) => {
			// Only handle messages from our iframe
			if (event.source !== iframeRef.current?.contentWindow) return

			// Check if it's an EditorBridge message
			if (event.data?.version !== "1.0.0") return

			const { category, type, payload } = event.data
			if (category === "event") {
				if (type === "TEXT_SELECTION_CHANGED") {
					// Text selection changed - update StylePanel store
					const hasSelection = payload?.hasSelection
					const selectedText = payload?.selectedText
					const containerSelector = payload?.containerSelector

					if (hasSelection && containerSelector) {
						stylePanelStore.setTextSelection({
							hasSelection: true,
							selectedText,
							containerSelector,
						})
					} else {
						stylePanelStore.setTextSelection(null)
					}
				} else if (type === "ELEMENT_SELECTED") {
					// Single element selected - show selection highlight
					const rect = payload?.rect
					const selector = payload?.selector
					const tagName = payload?.tagName ?? "div"
					const computedStyles = payload?.computedStyles ?? {}
					const rotation = payload?.rotation ?? 0

					if (rect && selector) {
						// Disable text editing on previous elements before switching
						// Use ref to avoid stale closure
						const previousSelectors = selectedInfoListRef.current.map(
							(info) => info.selector,
						)
						for (const prevSelector of previousSelectors) {
							if (prevSelector !== selector && editorRef?.current) {
								try {
									await editorRef.current.disableTextEditing(prevSelector)
									console.log(
										"[SelectionOverlay] Disabled text editing for previous element:",
										prevSelector,
									)
								} catch (error) {
									// Ignore error if element is already non-editable
									console.debug(
										"[SelectionOverlay] Previous element text editing already disabled",
									)
								}
							}
						}

						setSelectedInfoList([{ rect, selector, computedStyles, rotation }])
						setHoveredRect(null)
						setIsSelectionMode(true) // Ensure selection mode is active

						// Update StylePanelStore with single element
						stylePanelStore.selectElement({
							selector,
							tagName,
							computedStyles: computedStyles as any,
						})

						// Note: Text editing is now activated by double-click on selected element
						// No longer auto-enable text editing on selection
					}
				} else if (type === "ELEMENTS_SELECTED") {
					// Multiple elements selected - show all selection highlights
					const elements = payload?.elements

					if (elements && Array.isArray(elements)) {
						// Disable text editing on all previous elements
						// Use ref to avoid stale closure
						const previousSelectors = selectedInfoListRef.current.map(
							(info) => info.selector,
						)
						for (const prevSelector of previousSelectors) {
							if (editorRef?.current) {
								try {
									await editorRef.current.disableTextEditing(prevSelector)
								} catch (error) {
									// Ignore error
								}
							}
						}

						// Map elements to SelectedInfo format
						const newSelectedInfoList: SelectedInfo[] = elements.map((el) => ({
							rect: el.rect || { top: 0, left: 0, width: 0, height: 0 },
							selector: el.selector,
							computedStyles: el.computedStyles,
							rotation: el.rotation ?? 0,
						}))

						setSelectedInfoList(newSelectedInfoList)
						setHoveredRect(null)
						setIsSelectionMode(true)

						// Update StylePanelStore with multiple elements
						const selectedElementsInfo: Array<{
							selector: string
							tagName: string
							computedStyles: any
						}> = elements.map((el) => ({
							selector: el.selector,
							tagName: el.tagName || "div",
							computedStyles: el.computedStyles || {},
						}))
						stylePanelStore.selectElements(selectedElementsInfo)

						console.log(
							"[SelectionOverlay] Multiple elements selected:",
							newSelectedInfoList.length,
						)
					}
				} else if (type === "ELEMENT_DESELECTED") {
					// Single element deselected - clear selection highlight (backward compatibility)
					// Use ref to avoid stale closure
					const previousSelectors = selectedInfoListRef.current.map(
						(info) => info.selector,
					)
					for (const prevSelector of previousSelectors) {
						if (editorRef?.current) {
							try {
								await editorRef.current.disableTextEditing(prevSelector)
							} catch (error) {
								// Ignore error if element is already non-editable
								console.debug("[SelectionOverlay] Text editing already disabled")
							}
						}
					}
					setSelectedInfoList([])
				} else if (type === "ELEMENTS_DESELECTED") {
					// All elements deselected - clear all selection highlights
					// Use ref to avoid stale closure
					const previousSelectors = selectedInfoListRef.current.map(
						(info) => info.selector,
					)
					for (const prevSelector of previousSelectors) {
						if (editorRef?.current) {
							try {
								await editorRef.current.disableTextEditing(prevSelector)
							} catch (error) {
								// Ignore error
							}
						}
					}
					setSelectedInfoList([])
				} else if (type === "ELEMENT_HOVERED") {
					// Element hovered - show hover highlight
					const rect = payload?.rect
					if (rect) {
						setHoveredRect(rect)
						setIsSelectionMode(true) // Ensure selection mode is active
					}
				} else if (type === "ELEMENT_HOVER_END") {
					// Hover ended - clear hover highlight
					setHoveredRect(null)
				} else if (type === "SELECTION_MODE_CHANGED") {
					// Selection mode changed
					const newSelectionMode = payload?.isSelectionMode
					setIsSelectionMode(newSelectionMode)
					if (!newSelectionMode) {
						// Clear all highlights when selection mode is disabled
						setSelectedInfoList([])
						setHoveredRect(null)
						stylePanelStore.setTextSelection(null)
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
		// Remove selectedInfoList from dependencies to prevent effect re-registration
		// Use ref instead to access current value
	}, [
		iframeRef,
		editorRef,
		stylePanelStore,
		setSelectedInfoList,
		setHoveredRect,
		setIsSelectionMode,
	])
}
