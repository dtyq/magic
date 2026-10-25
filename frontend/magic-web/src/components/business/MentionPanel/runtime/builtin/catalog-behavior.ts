import { MentionItemType, PanelState } from "../../types"
import type { MentionPanelCatalogBehavior, StateTransition } from "../../types"
import { MentionPanelBuiltinItemId as BuiltinItemId, MentionPanelCatalogId } from "./catalog-ids"
import { isCanvasElementsMentionItemId } from "./domains/canvas-elements"
import { MentionPanelItemType } from "./panel-item-types"

function buildCatalogTransition(catalogId: string): StateTransition<string> {
	return {
		state: PanelState.CATALOG,
		catalogId,
	}
}

const DEFAULT_STATE_TRANSITIONS: Record<PanelState, Record<string, StateTransition<string>>> = {
	[PanelState.DEFAULT]: {
		[BuiltinItemId.PERSONAL_DRIVE]: { state: PanelState.FOLDER },
		[BuiltinItemId.ENTERPRISE_DRIVE]: { state: PanelState.FOLDER },
		[BuiltinItemId.PROJECT_FILES]: { state: PanelState.FOLDER },
		[BuiltinItemId.CANVAS_ELEMENTS]: { state: PanelState.FOLDER },
		[BuiltinItemId.MCP_EXTENSIONS]: buildCatalogTransition(
			MentionPanelCatalogId.MCP_EXTENSIONS,
		),
		[BuiltinItemId.DIGITAL_EMPLOYEES]: buildCatalogTransition(
			MentionPanelCatalogId.DIGITAL_EMPLOYEES,
		),
		[BuiltinItemId.FLOWS]: buildCatalogTransition(MentionPanelCatalogId.FLOWS),
		[BuiltinItemId.AGENTS]: buildCatalogTransition(MentionPanelCatalogId.AGENTS),
		[BuiltinItemId.MICRO_APPS]: buildCatalogTransition(MentionPanelCatalogId.MICRO_APPS),
		[BuiltinItemId.SKILLS]: buildCatalogTransition(MentionPanelCatalogId.SKILLS),
		[BuiltinItemId.TOOLS]: buildCatalogTransition(MentionPanelCatalogId.TOOLS),
		[BuiltinItemId.UPLOAD_FILES]: buildCatalogTransition(MentionPanelCatalogId.UPLOAD_FILES),
		[BuiltinItemId.SCENE_CATALOG]: buildCatalogTransition(MentionPanelCatalogId.SCENE_CATALOG),
	},
	[PanelState.SEARCH]: {},
	[PanelState.FOLDER]: {},
	[PanelState.CATALOG]: {},
}

export const defaultMentionPanelCatalogBehavior: MentionPanelCatalogBehavior<string> = {
	getStaticTransition: ({ currentState, itemId }) =>
		DEFAULT_STATE_TRANSITIONS[currentState]?.[itemId] ?? null,
	getDynamicTransition: ({ currentCatalogId, selectedItem, enterFolder }) => {
		if (currentCatalogId === MentionPanelCatalogId.FLOWS) {
			if (selectedItem.id === BuiltinItemId.AGENTS) {
				return buildCatalogTransition(MentionPanelCatalogId.AGENTS)
			}

			if (selectedItem.id === BuiltinItemId.TOOLS) {
				return buildCatalogTransition(MentionPanelCatalogId.TOOLS)
			}
		}

		switch (selectedItem.type) {
			case MentionItemType.FOLDER:
				if (enterFolder && selectedItem.isFolder) {
					return {
						state: PanelState.FOLDER,
					}
				}
				return null
			case MentionItemType.TOOL:
				if (selectedItem.isFolder)
					return buildCatalogTransition(currentCatalogId ?? MentionPanelCatalogId.TOOLS)
				return null
			case MentionPanelItemType.TABS:
				return buildCatalogTransition(MentionPanelCatalogId.TABS)
			case MentionPanelItemType.HISTORIES:
				return buildCatalogTransition(MentionPanelCatalogId.HISTORIES)
			case MentionItemType.TEXT:
				return null
			case MentionItemType.MCP:
			case MentionItemType.AGENT:
			case MentionItemType.SKILL:
			case MentionItemType.PROJECT_FILE:
			case MentionItemType.UPLOAD_FILE:
			case MentionItemType.CLOUD_FILE:
				return null
			default:
				return null
		}
	},
	shouldEnterFolderDirectly: ({ selectedItem }) =>
		selectedItem.type === MentionItemType.FOLDER &&
		selectedItem.isFolder === true &&
		isCanvasElementsMentionItemId(selectedItem.id),
	shouldSelectItemDirectly: ({ currentState, currentCatalogId, selectedItem, enterFolder }) =>
		currentState === PanelState.CATALOG &&
		currentCatalogId === MentionPanelCatalogId.TABS &&
		selectedItem.type === MentionItemType.FOLDER &&
		!enterFolder,
}
