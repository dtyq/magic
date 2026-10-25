import { useEffect, useRef } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ElementRect, SelectedInfo } from "../types"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"

interface UseSelectionMessagesProps {
	iframeRef: React.RefObject<HTMLIFrameElement>
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	selectedInfoList: SelectedInfo[]
	setSelectedInfoList: React.Dispatch<React.SetStateAction<SelectedInfo[]>>
	setHoveredRect: React.Dispatch<React.SetStateAction<ElementRect | null>>
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
	// Message handlers are async because text editing must be disabled before the
	// next selection is applied. Ignore work started by an older selection event
	// so a delayed deselection cannot clear a newer selection.
	const selectionRevisionRef = useRef(0)

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
					const selectionRevision = ++selectionRevisionRef.current
					// Single element selected - show selection highlight
					const rect = payload?.rect
					const selector = payload?.selector
					const tagName = payload?.tagName ?? "div"
					const computedStyles = payload?.computedStyles ?? {}
					const rotation = payload?.rotation ?? 0
					const isImageElement = payload?.isImageElement ?? false
					const intrinsicWidth = payload?.intrinsicWidth
					const intrinsicHeight = payload?.intrinsicHeight
					const intrinsicAspectRatio = payload?.intrinsicAspectRatio
					const isTextElement = payload?.isTextElement ?? false
					const hasDirectTextContent = payload?.hasDirectTextContent
					const textContent = payload?.textContent

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
						if (selectionRevision !== selectionRevisionRef.current) return

						setSelectedInfoList([
							{
								rect,
								selector,
								childRects: payload?.childRects,
								computedStyles,
								rotation,
								isImageElement,
								isTextElement,
								hasDirectTextContent,
								textContent,
								ancestors: payload?.ancestors,
								inlineStyles: payload?.inlineStyles,
								attributes: payload?.attributes,
								intrinsicWidth,
								intrinsicHeight,
								intrinsicAspectRatio,
							},
						])
						setHoveredRect(null)
						setIsSelectionMode(true) // Ensure selection mode is active

						// Update StylePanelStore with single element
						stylePanelStore.selectElement({
							selector,
							tagName,
							isImageElement,
							isTextElement,
							hasDirectTextContent,
							textContent,
							ancestors: payload?.ancestors,
							intrinsicWidth,
							intrinsicHeight,
							intrinsicAspectRatio,
							inlineStyles: payload?.inlineStyles,
							computedStyles,
						})

						// Note: Text editing is now activated by double-click on selected element
						// No longer auto-enable text editing on selection
					}
				} else if (type === "ELEMENTS_SELECTED") {
					const selectionRevision = ++selectionRevisionRef.current
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
						if (selectionRevision !== selectionRevisionRef.current) return

						// Map elements to SelectedInfo format
						const newSelectedInfoList: SelectedInfo[] = elements.map((el) => ({
							rect: el.rect || { top: 0, left: 0, width: 0, height: 0 },
							selector: el.selector,
							computedStyles: el.computedStyles,
							rotation: el.rotation ?? 0,
							isImageElement: el.isImageElement ?? false,
							isTextElement: el.isTextElement,
							hasDirectTextContent: el.hasDirectTextContent,
							textContent: el.textContent,
							inlineStyles: el.inlineStyles,
							attributes: el.attributes,
							intrinsicWidth: el.intrinsicWidth,
							intrinsicHeight: el.intrinsicHeight,
							intrinsicAspectRatio: el.intrinsicAspectRatio,
						}))

						setSelectedInfoList(newSelectedInfoList)
						setHoveredRect(null)
						setIsSelectionMode(true)

						// Update StylePanelStore with multiple elements
						const selectedElementsInfo = elements.map((el) => ({
							selector: el.selector,
							tagName: el.tagName || "div",
							isImageElement: el.isImageElement ?? false,
							intrinsicWidth: el.intrinsicWidth,
							intrinsicHeight: el.intrinsicHeight,
							intrinsicAspectRatio: el.intrinsicAspectRatio,
							isTextElement: el.isTextElement,
							hasDirectTextContent: el.hasDirectTextContent,
							textContent: el.textContent,
							inlineStyles: el.inlineStyles,
							computedStyles: el.computedStyles || {},
						}))
						stylePanelStore.selectElements(selectedElementsInfo)

						console.log(
							"[SelectionOverlay] Multiple elements selected:",
							newSelectedInfoList.length,
						)
					}
				} else if (type === "ELEMENT_DESELECTED") {
					const selectionRevision = ++selectionRevisionRef.current
					// Single element deselected - clear selection highlight (backward compatibility)
					// Use ref to avoid stale closure
					const previousSelectors = selectedInfoListRef.current.map(
						(info) => info.selector,
					)
					for (const prevSelector of previousSelectors) {
						if (!editorRef?.current) continue
						try {
							await editorRef.current.disableTextEditing(prevSelector)
						} catch (error) {
							// Ignore error if element is already non-editable
							console.debug("[SelectionOverlay] Text editing already disabled")
						}
					}
					if (selectionRevision !== selectionRevisionRef.current) return
					setSelectedInfoList([])
				} else if (type === "ELEMENTS_DESELECTED") {
					const selectionRevision = ++selectionRevisionRef.current
					// All elements deselected - clear all selection highlights
					// Use ref to avoid stale closure
					const previousSelectors = selectedInfoListRef.current.map(
						(info) => info.selector,
					)
					for (const prevSelector of previousSelectors) {
						if (!editorRef?.current) continue
						try {
							await editorRef.current.disableTextEditing(prevSelector)
						} catch (error) {
							// Ignore error
						}
					}
					if (selectionRevision !== selectionRevisionRef.current) return
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
					selectionRevisionRef.current += 1
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
