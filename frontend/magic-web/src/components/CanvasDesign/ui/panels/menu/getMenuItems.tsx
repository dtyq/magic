import {
	ArrowDown,
	ArrowDownToLine,
	ArrowUp,
	ArrowUpToLine,
	Copy,
	CopyPlus,
	Eye,
	EyeClosed,
	FileDown,
	FolderSearch,
	Frame,
	Layers,
	LockKeyhole,
	LockOpen,
	MessageSquarePlus,
	MessageSquareReply,
	Pencil,
	FolderPlus,
	ShieldCheck,
	Trash2,
	ArchiveX,
	ArchiveRestore,
} from "lucide-react"
import { toast } from "sonner"
import type { ImageDiscardActionOptions } from "../../../runtime/actions/types"
import { FrameDotted, VIPTag } from "../../primitives/icons/index"
import type { ImageElementContent, LayerElement } from "../../../runtime/document/types"
import { ElementTypeEnum } from "../../../runtime/document/types"
import type { MenuItem, MenuOption, MenuSource } from "./types"
import type { Canvas } from "../../../runtime/core/Canvas"
import fileImage from "../../../assets/svg/file-image.svg"
import { getShortcutDisplay } from "../../../runtime/shared/lib/index"
import type { TFunction } from "../../../public/i18n-types"
import { getSelectedFileElements } from "../../../runtime/shared/ids"
import type { MagicPermissions } from "../../../public/magic-types"
import type { CanvasDownloadMenuContext } from "./resolveCanvasDownloadMenuContext"
import styles from "./index.module.css"

interface RenameMenuConfig {
	menuSource?: MenuSource | null
	onRenameElement?: (elementId: string, source: MenuSource | null) => void
	canRenameElement?: (elementId: string, source: MenuSource | null) => boolean
}

interface SaveAssetMenuConfig {
	onSaveAsset?: (elementId: string) => void
	canSaveAsset?: (elementId: string) => boolean
}

interface SeedanceComplianceMenuConfig {
	onCheckCompliance?: (elementId: string) => void
	canCheckCompliance?: (elementId: string) => boolean
}

export interface GetMenuItemsParams {
	canvas: Canvas
	selectedIds: string[]
	currentElementId: string | null
	t?: TFunction
	/** 由 resolveCanvasDownloadMenuContext(canvas) 得到；省略时不出 AI 子菜单（预计算菜单项数量等场景） */
	downloadMenuContext?: CanvasDownloadMenuContext | null
	renameMenuConfig?: RenameMenuConfig
	saveAssetMenuConfig?: SaveAssetMenuConfig
	complianceMenuConfig?: SeedanceComplianceMenuConfig
	permissions?: MagicPermissions
}

// 默认菜单项配置
export function getMenuItems({
	canvas,
	selectedIds,
	currentElementId,
	t,
	downloadMenuContext,
	renameMenuConfig,
	saveAssetMenuConfig,
	complianceMenuConfig,
	permissions,
}: GetMenuItemsParams): MenuItem[] {
	const canWrite = canvas.permissionManager.can("document.write")
	const includeConversationMenuItems = permissions?.elementMenuConversationActions !== false
	// 默认翻译函数
	const translate = (key: string, fallback: string) => {
		return t ? t(key, fallback) : fallback
	}

	let selectedElements = selectedIds
		.map((id) => canvas.elementManager.getElementData(id))
		.filter((el): el is LayerElement => el !== undefined)

	// 右键打开菜单时 React 选区可能尚未同步；选区为空时用 currentElementId 作为菜单上下文
	if (!selectedElements.length && !!currentElementId) {
		const currentElement = canvas.elementManager.getElementData(currentElementId)
		if (currentElement) {
			selectedElements = [currentElement]
		}
	}

	const isMultiSelect = selectedElements.length > 1
	const isSingleVideoElement =
		selectedElements.length === 1 && selectedElements[0].type === ElementTypeEnum.Video

	// 判断选中元素的状态
	const allUnlocked = selectedElements.every((el) => el.locked !== true)
	const allVisible = selectedElements.every((el) => el.visible !== false)
	const imageTargets = selectedElements.flatMap((element) => {
		if (element.type !== ElementTypeEnum.Image) return []
		const contentId = canvas.getEffectiveContentId(element.id)
		return contentId ? [{ elementId: element.id, contentId }] : []
	})
	const allDiscarded = imageTargets.every(
		(target) =>
			canvas.getEffectiveContent<ImageElementContent>(target.elementId)?.discarded === true,
	)
	const discardOptions: ImageDiscardActionOptions = {
		targets: imageTargets,
		discarded: !allDiscarded,
	}
	const canDiscard =
		imageTargets.length === selectedElements.length &&
		canvas.userActionRegistry.canExecute("image.set-discarded", discardOptions)
	const selectedFileElements = getSelectedFileElements(canvas)
	const hasSelectedImageElement = selectedFileElements.some((element) => element.type === "image")
	const hasSelectedVideoElement = selectedFileElements.some((element) => element.type === "video")
	const hasSelectedAudioElement = selectedFileElements.some((element) => element.type === "audio")
	const selectedFileTypeCount =
		Number(hasSelectedImageElement) +
		Number(hasSelectedVideoElement) +
		Number(hasSelectedAudioElement)

	const selectionKind =
		downloadMenuContext?.selectionKind ??
		(selectedFileTypeCount > 1
			? "mixed"
			: hasSelectedVideoElement
				? "video-only"
				: hasSelectedAudioElement
					? "audio-only"
					: hasSelectedImageElement
						? "image-only"
						: "none")
	const downloadLabel =
		selectionKind === "video-only"
			? translate("menu.downloadVideo", "下载视频")
			: selectionKind === "audio-only"
				? translate("menu.downloadAudio", "下载音频")
				: translate("menu.downloadFile", "下载文件")

	const useAiImageSubmenu = downloadMenuContext?.useAiImageSubmenu === true

	const copyMenuItem: MenuItem = {
		id: "copy",
		label: translate("menu.copy", "复制"),
		icon: Copy,
		shortcut: getShortcutDisplay("edit.copy"),
		onClick: () => {
			canvas.userActionRegistry.execute("edit.copy")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("edit.copy")
		},
	}

	const duplicateOptions = { elementIds: selectedElements.map((element) => element.id) }
	const duplicateMenuItem: MenuItem = {
		id: "duplicate",
		label: translate("menu.duplicate", "创建副本"),
		icon: CopyPlus,
		shortcut: getShortcutDisplay("edit.duplicate"),
		onClick: () => {
			void canvas.userActionRegistry.execute("edit.duplicate", duplicateOptions)
		},
		visible: () => canvas.userActionRegistry.canExecute("edit.duplicate", duplicateOptions),
	}

	const copyPngMenuItem: MenuItem = {
		id: "copy-png",
		label: translate("menu.copyPng", "复制为 PNG"),
		icon: CopyPlus,
		shortcut: getShortcutDisplay("edit.copy-png"),
		onClick: () => {
			canvas.userActionRegistry.execute("edit.copy-png")
		},
		visible: () => {
			return !isSingleVideoElement && canvas.userActionRegistry.canExecute("edit.copy-png")
		},
	}

	const singleDownloadUsesNoWatermark = permissions?.singleDownloadUsesNoWatermark === true
	const showNoWatermarkVip = permissions?.isFreeTrialVersion === true
	const noWatermarkLabelText = translate("menu.downloadImageNoWatermark", "下载无水印图片")
	const basicDownloadMenuItem: MenuItem = {
		id: "download-image",
		icon: FileDown,
		label: downloadLabel,
		onClick: async () => {
			await canvas.userActionRegistry.execute("download.image", {
				downloadMode: "default",
			})
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("download.image")
		},
	}

	const aiSubmenuDownloadImageItem: MenuItem = {
		id: "download-image",
		icon: FileDown,
		label: translate("menu.downloadImage", "下载图片"),
		onClick: async () => {
			await canvas.userActionRegistry.execute("download.image", {
				downloadMode: "normal",
			})
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("download.image")
		},
	}

	const flatSingleDownloadImageItem: MenuItem = {
		id: "download-image",
		icon: FileDown,
		label: translate("menu.downloadImage", "下载图片"),
		onClick: async () => {
			await canvas.userActionRegistry.execute("download.image-no-watermark")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("download.image-no-watermark")
		},
	}

	const noWatermarkChild = {
		id: "download-image-no-watermark",
		icon: <img src={fileImage as string} alt="" />,
		label: showNoWatermarkVip ? (
			<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
				<span>{noWatermarkLabelText}</span>
				<VIPTag />
			</span>
		) : (
			noWatermarkLabelText
		),
		onClick: async () => {
			await canvas.userActionRegistry.execute("download.image-no-watermark")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("download.image-no-watermark")
		},
	} as MenuOption

	const aiImageDownloadSubmenuChildren: MenuItem[] = [
		aiSubmenuDownloadImageItem,
		{ type: "separator" },
		noWatermarkChild,
	]

	const downloadMenuItem: MenuItem =
		useAiImageSubmenu && singleDownloadUsesNoWatermark
			? flatSingleDownloadImageItem
			: useAiImageSubmenu
				? {
						id: "download-image-group",
						label: translate("menu.downloadFile", "下载文件"),
						icon: FileDown,
						children: aiImageDownloadSubmenuChildren,
						visible: () => {
							return canvas.userActionRegistry.canExecute("download.image")
						},
					}
				: basicDownloadMenuItem

	const locateProjectFileMenuItem: MenuItem = {
		id: "locate-project-file",
		label: translate("menu.locateProjectFile", "定位到项目文件"),
		icon: FolderSearch,
		onClick: async () => {
			await canvas.userActionRegistry.execute("view.locate-project-file", {
				elementId: currentElementId ?? undefined,
			})
		},
		visible: () => {
			return (
				!isMultiSelect &&
				canvas.userActionRegistry.canExecute("view.locate-project-file", {
					elementId: currentElementId ?? undefined,
				})
			)
		},
	}

	const addToCurrentConversationMenuItem: MenuItem = {
		id: "add-to-current-conversation",
		label: translate("menu.addToCurrentConversation", "添加至当前对话"),
		icon: MessageSquareReply,
		shortcut: getShortcutDisplay("conversation.add-to-current"),
		onClick: async () => {
			await canvas.userActionRegistry.execute("conversation.add-to-current")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("conversation.add-to-current")
		},
	}

	const addToNewConversationMenuItem: MenuItem = {
		id: "add-to-new-conversation",
		label: translate("menu.addToNewConversation", "添加至新话题"),
		icon: MessageSquarePlus,
		shortcut: getShortcutDisplay("conversation.add-to-new"),
		onClick: async () => {
			await canvas.userActionRegistry.execute("conversation.add-to-new")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("conversation.add-to-new")
		},
	}

	const saveToAssetsMenuItem: MenuItem = {
		id: "save-to-assets",
		label: translate("menu.saveToAssets", "保存到素材库"),
		icon: FolderPlus,
		onClick: () => {
			if (!currentElementId) return
			saveAssetMenuConfig?.onSaveAsset?.(currentElementId)
		},
		visible: () => {
			const selectedType = selectedElements[0]?.type
			if (
				isMultiSelect ||
				selectedElements.length !== 1 ||
				(selectedType !== ElementTypeEnum.Image &&
					selectedType !== ElementTypeEnum.Video) ||
				!currentElementId
			) {
				return false
			}
			return saveAssetMenuConfig?.canSaveAsset?.(currentElementId) === true
		},
	}

	const seedanceComplianceMenuItem: MenuItem = {
		id: "seedance-compliance",
		label: translate("menu.seedanceCompliance", "Seedance 合规校验"),
		icon: ShieldCheck,
		onClick: () => {
			if (!currentElementId) return
			complianceMenuConfig?.onCheckCompliance?.(currentElementId)
		},
		visible: () => {
			const selectedType = selectedElements[0]?.type
			if (
				isMultiSelect ||
				selectedElements.length !== 1 ||
				(selectedType !== ElementTypeEnum.Image &&
					selectedType !== ElementTypeEnum.Video) ||
				!currentElementId
			) {
				return false
			}
			return complianceMenuConfig?.canCheckCompliance?.(currentElementId) === true
		},
	}

	// 无文档写能力时只提供会话/外部操作；具体能力仍由 UserActionRegistry 控制。
	if (!canWrite) {
		if (!includeConversationMenuItems) {
			return [
				copyMenuItem,
				copyPngMenuItem,
				{ type: "separator" },
				downloadMenuItem,
				locateProjectFileMenuItem,
				{ type: "separator" },
				saveToAssetsMenuItem,
				seedanceComplianceMenuItem,
			]
		}
		return [
			copyMenuItem,
			copyPngMenuItem,
			{ type: "separator" },
			addToCurrentConversationMenuItem,
			addToNewConversationMenuItem,
			{ type: "separator" },
			downloadMenuItem,
			locateProjectFileMenuItem,
			{ type: "separator" },
			saveToAssetsMenuItem,
			seedanceComplianceMenuItem,
		]
	}

	const renameMenuItem: MenuItem = {
		id: "rename",
		label: translate("menu.rename", "重命名"),
		icon: Pencil,
		onClick: () => {
			if (!currentElementId) return
			requestAnimationFrame(() => {
				renameMenuConfig?.onRenameElement?.(
					currentElementId,
					renameMenuConfig.menuSource ?? null,
				)
			})
		},
		visible: () => {
			if (isMultiSelect) {
				return false
			}

			if (!currentElementId) {
				return false
			}

			if (renameMenuConfig?.canRenameElement) {
				return renameMenuConfig.canRenameElement(
					currentElementId,
					renameMenuConfig.menuSource ?? null,
				)
			}

			return false
		},
	}

	const discardedMenuItem: MenuOption = {
		id: "set-discarded",
		label: allDiscarded
			? translate("menu.restoreDraft", "取消废稿标记")
			: translate("menu.discardDraft", "标记为废稿"),
		description: allDiscarded
			? translate("menu.restoreDraftDescription", "恢复正常显示")
			: translate("menu.discardDraftDescription", "保留图片，淡化显示"),
		icon: allDiscarded ? ArchiveRestore : ArchiveX,
		rightContentRender: allDiscarded
			? () => (
					<span className={styles.draftStatus}>
						{translate("menu.discardedStatus", "废稿")}
					</span>
				)
			: undefined,
		onClick: () => {
			if (!canvas.userActionRegistry.canExecute("image.set-discarded", discardOptions)) {
				toast.error(translate("menu.draftTargetChanged", "图片状态已变化，请重新操作"))
				return
			}
			void canvas.userActionRegistry.execute("image.set-discarded", discardOptions)
		},
	}
	const discardedBlock: MenuItem[] = canDiscard ? [discardedMenuItem, { type: "separator" }] : []

	const layerMenuItems: MenuOption[] = [
		{
			id: "move-up",
			label: translate("menu.moveUp", "上移一层"),
			icon: ArrowUp,
			shortcut: getShortcutDisplay("layer.move-up"),
			onClick: () => {
				canvas.userActionRegistry.execute("layer.move-up")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("layer.move-up")
			},
		},
		{
			id: "move-down",
			label: translate("menu.moveDown", "下移一层"),
			icon: ArrowDown,
			shortcut: getShortcutDisplay("layer.move-down"),
			onClick: () => {
				canvas.userActionRegistry.execute("layer.move-down")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("layer.move-down")
			},
		},
		{
			id: "move-to-top",
			label: translate("menu.moveToTop", "移至顶部"),
			icon: ArrowUpToLine,
			shortcut: getShortcutDisplay("layer.move-to-top"),
			onClick: () => {
				canvas.userActionRegistry.execute("layer.move-to-top")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("layer.move-to-top")
			},
		},
		{
			id: "move-to-bottom",
			label: translate("menu.moveToBottom", "移至底部"),
			icon: ArrowDownToLine,
			shortcut: getShortcutDisplay("layer.move-to-bottom"),
			onClick: () => {
				canvas.userActionRegistry.execute("layer.move-to-bottom")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("layer.move-to-bottom")
			},
		},
	]

	const conversationBlock: MenuItem[] = includeConversationMenuItems
		? [addToCurrentConversationMenuItem, addToNewConversationMenuItem, { type: "separator" }]
		: []

	return [
		copyMenuItem,
		duplicateMenuItem,
		copyPngMenuItem,
		{ type: "separator" },
		...discardedBlock,
		{
			id: "layer",
			label: translate("menu.layer", "图层"),
			icon: Layers,
			children: layerMenuItems,
			// 四项都不可见时隐藏分组，避免只读或锁定选区出现空子菜单。
			visible: () => layerMenuItems.some((item) => !item.visible || item.visible()),
		},
		{ type: "separator" },
		{
			id: "add-frame",
			label: translate("menu.addFrame", "添加画框"),
			icon: Frame,
			shortcut: getShortcutDisplay("frame.create"),
			onClick: () => {
				canvas.userActionRegistry.execute("frame.create")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("frame.create")
			},
		},
		{
			id: "remove-frame",
			label: translate("menu.removeFrame", "取消画框"),
			icon: FrameDotted,
			shortcut: getShortcutDisplay("frame.remove"),
			onClick: () => {
				canvas.userActionRegistry.execute("frame.remove")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("frame.remove")
			},
		},
		{ type: "separator" },
		{
			id: "toggle-visible",
			label: allVisible ? translate("menu.hide", "隐藏") : translate("menu.show", "显示"),
			icon: allVisible ? EyeClosed : Eye,
			shortcut: getShortcutDisplay("element.toggle-visible"),
			onClick: () => {
				canvas.userActionRegistry.execute("element.toggle-visible")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("element.toggle-visible")
			},
		},
		{
			id: "toggle-lock",
			label: allUnlocked ? translate("menu.lock", "锁定") : translate("menu.unlock", "解锁"),
			icon: allUnlocked ? LockKeyhole : LockOpen,
			shortcut: getShortcutDisplay("element.toggle-lock"),
			onClick: () => {
				canvas.userActionRegistry.execute("element.toggle-lock")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("element.toggle-lock")
			},
		},
		{ type: "separator" },
		renameMenuItem,
		{ type: "separator" },
		...conversationBlock,
		downloadMenuItem,
		locateProjectFileMenuItem,
		{ type: "separator" },
		saveToAssetsMenuItem,
		seedanceComplianceMenuItem,
		{ type: "separator" },
		{
			id: "delete",
			label: translate("menu.removeFromCanvas", "从画布移除"),
			help:
				selectedElements.length > 0 &&
				selectedElements.every((element) => element.type === ElementTypeEnum.Image)
					? translate(
							"menu.removeImageDescription",
							"仅移除画布中的元素，项目里的图片文件仍会保留。",
						)
					: translate("menu.removeElementDescription", "只移除画布元素"),
			variant: "destructive",
			icon: Trash2,
			onClick: () => {
				canvas.userActionRegistry.execute("edit.delete")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("edit.delete")
			},
		},
		{
			id: "delete-image-file",
			label: translate("menu.deleteImageFile", "移除并删除文件…"),
			help: translate(
				"menu.deleteImageFileDescription",
				"移除画布中的图片，并删除对应项目文件。删除的文件可从全局「回收站」恢复，但不会自动恢复画布中的元素和位置。多版本图片可在确认弹框中选择删除范围。",
			),
			variant: "destructive",
			icon: Trash2,
			onClick: () => {
				void canvas.userActionRegistry.execute("edit.delete-image-file", {
					elementId: currentElementId ?? selectedIds[0],
				})
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("edit.delete-image-file", {
					elementId: currentElementId ?? selectedIds[0],
				})
			},
		},
	]
}
