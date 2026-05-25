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
	Frame,
	LockKeyhole,
	LockOpen,
	MessageSquarePlus,
	MessageSquareReply,
	Pencil,
	Trash2,
} from "lucide-react"
import { FrameDotted, VIPTag } from "../ui/icons"
import type { LayerElement } from "../../canvas/types"
import { ElementTypeEnum } from "../../canvas/types"
import type { MenuItem, MenuOption, MenuSource } from "./types"
import type { Canvas } from "../../canvas/Canvas"
import fileImage from "../../assets/svg/file-image.svg"
import { getShortcutDisplay } from "../../lib/index"
import type { TFunction } from "../../context/I18nContext"
import { getLoadedFileElements } from "../../canvas/utils/utils"
import type { MagicPermissions } from "../../types.magic"
import type { CanvasDownloadMenuContext } from "./resolveCanvasDownloadMenuContext"

interface RenameMenuConfig {
	menuSource?: MenuSource | null
	onRenameElement?: (elementId: string, source: MenuSource | null) => void
	canRenameElement?: (elementId: string, source: MenuSource | null) => boolean
}

export interface GetMenuItemsParams {
	canvas: Canvas
	selectedIds: string[]
	currentElementId: string | null
	readonly?: boolean
	t?: TFunction
	/** 由 resolveCanvasDownloadMenuContext(canvas) 得到；省略时不出 AI 子菜单（预计算菜单项数量等场景） */
	downloadMenuContext?: CanvasDownloadMenuContext | null
	renameMenuConfig?: RenameMenuConfig
	permissions?: MagicPermissions
}

// 默认菜单项配置
export function getMenuItems({
	canvas,
	selectedIds,
	currentElementId,
	readonly,
	t,
	downloadMenuContext,
	renameMenuConfig,
	permissions,
}: GetMenuItemsParams): MenuItem[] {
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
	const loadedFileElements = getLoadedFileElements(canvas)
	const hasLoadedImageElement = loadedFileElements.some((element) => element.type === "image")
	const hasLoadedVideoElement = loadedFileElements.some((element) => element.type === "video")

	const selectionKind =
		downloadMenuContext?.selectionKind ??
		(hasLoadedVideoElement && hasLoadedImageElement
			? "mixed"
			: hasLoadedVideoElement
				? "video-only"
				: hasLoadedImageElement
					? "image-only"
					: "none")

	const downloadLabel =
		selectionKind === "video-only"
			? translate("menu.downloadVideo", "下载视频")
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
			await canvas.userActionRegistry.execute("download.image")
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
			await canvas.userActionRegistry.execute("download.image")
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

	// 只读：复制/下载；可选添加至对话（与可编辑菜单一致，由 canExecute 控制显隐）
	if (readonly) {
		if (!includeConversationMenuItems) {
			return [copyMenuItem, copyPngMenuItem, { type: "separator" }, downloadMenuItem]
		}
		return [
			copyMenuItem,
			copyPngMenuItem,
			{ type: "separator" },
			addToCurrentConversationMenuItem,
			addToNewConversationMenuItem,
			{ type: "separator" },
			downloadMenuItem,
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

	const conversationBlock: MenuItem[] = includeConversationMenuItems
		? [addToCurrentConversationMenuItem, addToNewConversationMenuItem, { type: "separator" }]
		: []

	return [
		copyMenuItem,
		copyPngMenuItem,
		{ type: "separator" },
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
		{ type: "separator" },
		{
			id: "delete",
			label: translate("menu.delete", "删除"),
			icon: Trash2,
			onClick: () => {
				canvas.userActionRegistry.execute("edit.delete")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("edit.delete")
			},
		},
	]
}
