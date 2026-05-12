import MentionPanel from "@/components/business/MentionPanel"
import {
	MentionItemType,
	PanelState,
	type MentionItem,
	type MentionPanelCatalogBehaviorArgs,
	type ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelRendererProps,
} from "@/components/CanvasDesign/types"
import { useMagic } from "@/components/CanvasDesign/context/MagicContext"
import type { ComponentType } from "react"
import { useEffect, useMemo } from "react"

const PANEL_CLASS_NAME = "canvas-design-reference-resource-panel"

interface CanvasReferenceResourceCatalogBehavior {
	shouldEnterFolderDirectly?: (args: MentionPanelCatalogBehaviorArgs<string>) => boolean
	getDynamicTransition?: (
		args: MentionPanelCatalogBehaviorArgs<string>,
	) => { state: PanelState } | null
}

interface CanvasMentionPanelProps {
	visible: boolean
	triggerRef?: React.RefObject<HTMLElement | null>
	language?: string
	className?: string
	initialState?: PanelState
	initialLoadOptions?: {
		itemId: string
	}
	initialNavigationStack?: Array<{
		id: string
		name: string
		state: PanelState
	}>
	lockDismissToExplicitClose?: boolean
	onSelect: (item: MentionItem, context?: { reset?: () => void }) => void
	onClose: () => void
	dataService?: ReferenceResourcePanelRendererProps["dataService"]
	catalogBehavior?: CanvasReferenceResourceCatalogBehavior
}

const TypedMentionPanel = MentionPanel as unknown as ComponentType<CanvasMentionPanelProps>

function isProjectFileMentionItem(item: MentionItem): item is MentionItem & {
	type: typeof MentionItemType.PROJECT_FILE
	data: ProjectFileMentionData
} {
	return item.type === "project_file" && Boolean(item.data)
}

function toReferenceResourcePanelItem(item: MentionItem): ReferenceResourcePanelItem | null {
	if (!isProjectFileMentionItem(item)) return null
	return {
		type: item.type,
		data: item.data,
	}
}

const referenceResourceCatalogBehavior: CanvasReferenceResourceCatalogBehavior = {
	shouldEnterFolderDirectly: ({
		selectedItem,
		enterFolder,
	}: MentionPanelCatalogBehaviorArgs<string>) => {
		return Boolean(
			!enterFolder && selectedItem.type === MentionItemType.FOLDER && selectedItem.isFolder,
		)
	},
	getDynamicTransition: ({
		selectedItem,
		enterFolder,
	}: MentionPanelCatalogBehaviorArgs<string>) => {
		if (selectedItem.type !== MentionItemType.FOLDER) return null
		if (!enterFolder || !selectedItem.isFolder) return null

		return {
			state: PanelState.FOLDER,
		}
	},
}

export function CanvasDesignReferenceResourcePanel(props: ReferenceResourcePanelRendererProps) {
	const { visible, triggerRef, language, dataService, onSelect, onClose } = props
	const { defaultProjectAttachmentFolderId, defaultProjectAttachmentFolderName } = useMagic()

	useEffect(() => {
		if (!visible) return

		function handlePointerDown(event: PointerEvent) {
			const target = event.target
			if (!(target instanceof Element)) return
			if (target.closest(`.${PANEL_CLASS_NAME}`)) return
			if (triggerRef?.current instanceof Node && triggerRef.current.contains(target)) return
			onClose()
		}

		document.addEventListener("pointerdown", handlePointerDown, true)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown, true)
		}
	}, [visible, triggerRef, onClose])

	const initialLoadOptions = useMemo(() => {
		if (!defaultProjectAttachmentFolderId) return undefined
		return {
			itemId: defaultProjectAttachmentFolderId,
		}
	}, [defaultProjectAttachmentFolderId])

	const initialNavigationStack = useMemo(() => {
		if (!defaultProjectAttachmentFolderId || !defaultProjectAttachmentFolderName)
			return undefined
		return [
			{
				id: defaultProjectAttachmentFolderId,
				name: defaultProjectAttachmentFolderName,
				state: PanelState.DEFAULT,
			},
		]
	}, [defaultProjectAttachmentFolderId, defaultProjectAttachmentFolderName])

	return (
		<TypedMentionPanel
			visible={visible}
			triggerRef={triggerRef}
			language={language}
			className={PANEL_CLASS_NAME}
			initialState={initialLoadOptions ? PanelState.FOLDER : undefined}
			initialLoadOptions={initialLoadOptions}
			initialNavigationStack={initialNavigationStack}
			lockDismissToExplicitClose
			onSelect={(item, context) => {
				const panelItem = toReferenceResourcePanelItem(item)
				if (!panelItem) return
				onSelect(panelItem, context)
			}}
			onClose={onClose}
			dataService={dataService}
			catalogBehavior={referenceResourceCatalogBehavior}
		/>
	)
}
