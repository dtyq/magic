export const MENTION_PANEL_SELECTION_SUMMARY_HEIGHT = 20
export const SELECTED_ITEM_CARD_SIZE = {
	list: 36,
	gallery: 60,
} as const

const SELECTED_ITEMS_STRIP_VERTICAL_SPACE = 12

export function getSelectedItemsStripHeight(isGalleryMode: boolean): number {
	return (
		(isGalleryMode ? SELECTED_ITEM_CARD_SIZE.gallery : SELECTED_ITEM_CARD_SIZE.list) +
		SELECTED_ITEMS_STRIP_VERTICAL_SPACE
	)
}

interface ResolveMentionPanelHeightOptions {
	baseHeight: number
	isGalleryMode: boolean
	showSelectionSummary: boolean
	showSelectedItems: boolean
}

/** Bottom status rows are additive so the scrollable content area keeps its base height. */
export function resolveMentionPanelHeight({
	baseHeight,
	isGalleryMode,
	showSelectionSummary,
	showSelectedItems,
}: ResolveMentionPanelHeightOptions): number {
	return (
		baseHeight +
		(showSelectionSummary ? MENTION_PANEL_SELECTION_SUMMARY_HEIGHT : 0) +
		(showSelectedItems ? getSelectedItemsStripHeight(isGalleryMode) : 0)
	)
}
