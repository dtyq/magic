import { useEffect, useCallback } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { type SelectedElementInfo } from "../../../iframe-bridge/stores/StylePanelStore"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"

/**
 * 使用选中元素的 Hook
 * 处理元素选择、样式更新等逻辑
 */
export function useSelectedElement(editorRef: React.RefObject<HTMLEditorV2Ref>) {
	const stylePanelStore = useStylePanelStore()

	/**
	 * 更新选中文本的样式到 selectedElement
	 * 当有文本选择时，获取选中文本的实际样式并更新到 store
	 */
	const updateTextSelectionStyles = useCallback(async () => {
		if (
			!editorRef.current ||
			!stylePanelStore.textSelection?.hasSelection ||
			!stylePanelStore.selectedElement
		) {
			return
		}

		try {
			// Get the actual computed styles of the selected text
			const textStyles = await editorRef.current.getTextSelectionStyles()

			if (textStyles && Object.keys(textStyles).length > 0) {
				// Update the selectedElement with text selection styles
				// This ensures the style panel displays the correct styles
				stylePanelStore.selectElement({
					selector: stylePanelStore.selectedElement.selector,
					tagName: stylePanelStore.selectedElement.tagName,
					computedStyles: {
						...stylePanelStore.selectedElement.computedStyles,
						...textStyles,
					} as any,
				})
			}
		} catch (error) {
			console.debug("[useSelectedElement] Failed to update text selection styles:", error)
		}
	}, [editorRef, stylePanelStore])

	/**
	 * 监听文本选择变化，更新样式
	 */
	useEffect(() => {
		if (stylePanelStore.textSelection?.hasSelection) {
			updateTextSelectionStyles()
		}
	}, [stylePanelStore.textSelection?.hasSelection, updateTextSelectionStyles])

	/**
	 * 启用选择模式
	 */
	const enableSelectionMode = useCallback(async () => {
		if (!editorRef.current) return

		try {
			await editorRef.current.enableSelectionMode()
			stylePanelStore.setSelectionMode(true)
		} catch (error) {
			console.error("启用选择模式失败:", error)
		}
	}, [editorRef, stylePanelStore])

	/**
	 * 禁用选择模式
	 */
	const disableSelectionMode = useCallback(async () => {
		if (!editorRef.current) return

		try {
			await editorRef.current.disableSelectionMode()
			stylePanelStore.setSelectionMode(false)
		} catch (error) {
			console.error("禁用选择模式失败:", error)
		}
	}, [editorRef, stylePanelStore])

	/**
	 * 切换选择模式
	 */
	const toggleSelectionMode = useCallback(async () => {
		if (stylePanelStore.isSelectionMode) {
			await disableSelectionMode()
		} else {
			await enableSelectionMode()
		}
	}, [enableSelectionMode, disableSelectionMode, stylePanelStore])

	/**
	 * 更新样式（支持元素样式和文本样式）
	 */
	const updateStyle = useCallback(
		async (property: string, value: string) => {
			if (!editorRef.current) return

			try {
				const textSelection = stylePanelStore.textSelection
				const hasTextSelection = Boolean(textSelection?.hasSelection)
				const selectors = hasTextSelection ? [] : stylePanelStore.getSelectedSelectors()

				// Check if we have a text selection (selected portion of text)
				if (hasTextSelection && textSelection) {
					// Apply style to selected text portion
					const { containerSelector } = textSelection
					await editorRef.current.applyTextStyle(containerSelector, { [property]: value })

					// Text selection will be cleared automatically by TextStyleManager
					// No need to update store here
				} else {
					// Get all selected selectors (handles both single and multi-select)
					if (selectors.length === 0) {
						console.warn("No elements selected")
						return
					}

					// Apply style to all selected elements
					if (selectors.length === 1) {
						await editorRef.current.setBatchStyles(selectors[0], { [property]: value })
					} else {
						await editorRef.current.setBatchStylesMultiple(selectors, {
							[property]: value,
						})

						await editorRef.current.refreshSelectedElements(selectors)
					}

					// For single select, update the computed styles
					if (selectors.length === 1 && stylePanelStore.selectedElement) {
						const updatedStyles = await editorRef.current.getElementComputedStyles(
							selectors[0],
						)

						if (updatedStyles && Object.keys(updatedStyles).length > 0) {
							stylePanelStore.selectElement({
								selector: selectors[0],
								tagName: stylePanelStore.selectedElement.tagName,
								computedStyles:
									updatedStyles as SelectedElementInfo["computedStyles"],
							})
						}
					}
					// For multi-select, we don't update computed styles as they may differ
				}
			} catch (error) {
				console.error("更新样式失败:", error)
			}
		},
		[editorRef, stylePanelStore],
	)

	/**
	 * 批量更新样式（支持元素样式和文本样式）
	 */
	const updateBatchStyles = useCallback(
		async (styles: Record<string, string>) => {
			if (!editorRef.current) return

			try {
				// Check if we have a text selection (selected portion of text)
				if (stylePanelStore.textSelection?.hasSelection) {
					// Apply styles to selected text portion
					const { containerSelector } = stylePanelStore.textSelection
					await editorRef.current.applyTextStyle(containerSelector, styles as any)

					// Text selection will be cleared automatically by TextStyleManager
					// No need to update store here
				} else {
					// Get all selected selectors (handles both single and multi-select)
					const selectors = stylePanelStore.getSelectedSelectors()

					if (selectors.length === 0) {
						console.warn("No elements selected")
						return
					}

					// Apply styles to all selected elements
					if (selectors.length === 1) {
						await editorRef.current.setBatchStyles(selectors[0], styles)
					} else {
						await editorRef.current.setBatchStylesMultiple(selectors, styles)
					}

					// For single select, update the computed styles
					if (selectors.length === 1 && stylePanelStore.selectedElement) {
						const updatedStyles = await editorRef.current.getElementComputedStyles(
							selectors[0],
						)

						if (updatedStyles && Object.keys(updatedStyles).length > 0) {
							stylePanelStore.selectElement({
								selector: selectors[0],
								tagName: stylePanelStore.selectedElement.tagName,
								computedStyles:
									updatedStyles as SelectedElementInfo["computedStyles"],
							})
						}
					}
				}
			} catch (error) {
				console.error("批量更新样式失败:", error)
			}
		},
		[editorRef, stylePanelStore],
	)

	/**
	 * 清除选择
	 */
	const clearSelection = useCallback(() => {
		stylePanelStore.clearSelection()
	}, [stylePanelStore])

	// 组件卸载时清理
	useEffect(() => {
		return () => {
			// 不需要清理，因为 store 可能被其他组件使用
		}
	}, [])

	return {
		selectedElement: stylePanelStore.selectedElement,
		isSelectionMode: stylePanelStore.isSelectionMode,
		enableSelectionMode,
		disableSelectionMode,
		toggleSelectionMode,
		updateStyle,
		updateBatchStyles,
		clearSelection,
	}
}
