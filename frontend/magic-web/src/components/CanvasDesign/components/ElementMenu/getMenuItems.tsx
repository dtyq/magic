import {
	Copy,
	ClipboardPaste,
	FrameDotted,
	ArrowUp,
	Eye,
	EyeClosed,
	LockKeyhole,
	LockOpen,
	Frame,
	ArrowDown,
	Trash2,
	ArrowUpToLine,
	ArrowDownToLine,
	FileDown,
	MessageSquareReply,
	MessageSquarePlus,
	CopyPlus,
} from "../ui/icons/index"
import type { LayerElement } from "../../canvas/types"
import type { MenuItem } from "./types"
import type { Canvas } from "../../canvas/Canvas"
import type { CanvasDesignMethods, MagicPermissions } from "../../types.magic"
import fileImage from "../../assets/svg/file-image.svg"
import { getShortcutDisplay } from "../../lib/index"
import type { TFunction } from "../../context/I18nContext"

// 默认菜单项配置
export function getMenuItems(
	canvas: Canvas,
	selectedIds: string[],
	currentElementId: string | null,
	methods?: CanvasDesignMethods,
	magicPermissions?: MagicPermissions,
	readonly?: boolean,
	t?: TFunction,
): MenuItem[] {
	// 默认翻译函数
	const translate = (key: string, fallback: string) => {
		return t ? t(key, fallback) : fallback
	}

	let selectedElements = selectedIds
		.map((id) => canvas.elementManager.getElementData(id))
		.filter((el): el is LayerElement => el !== undefined)

	// 元素被锁定的情况下,打开菜单,是没有选中元素的
	if (!selectedElements.length && !!currentElementId) {
		const currentElement = canvas.elementManager.getElementData(currentElementId)
		if (currentElement) {
			selectedElements = [currentElement]
		}
	}

	// 判断选中元素的状态
	const allUnlocked = selectedElements.every((el) => el.locked !== true)
	const allVisible = selectedElements.every((el) => el.visible !== false)

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
			return canvas.userActionRegistry.canExecute("edit.copy-png")
		},
	}

	const shouldShowHighQualityDownload = magicPermissions?.downloadMenuMode === "submenu"
	const basicDownloadMenuItem: MenuItem = {
		id: "download-image",
		icon: shouldShowHighQualityDownload ? <img src={fileImage} /> : FileDown,
		label: translate("menu.downloadImage", "下载图片"),
		onClick: async () => {
			await canvas.userActionRegistry.execute("download.image")
		},
		visible: () => {
			return canvas.userActionRegistry.canExecute("download.image")
		},
	}

	const downloadMenuItem: MenuItem = shouldShowHighQualityDownload
		? {
				id: "download-image-group",
				label: translate("menu.downloadImage", "下载图片"),
				icon: FileDown,
				children: [
					basicDownloadMenuItem,
					{ type: "separator" },
					{
						id: "download-image-no-watermark",
						icon: <img src={fileImage} />,
						label: translate("menu.downloadImageNoWatermark", "下载无水印图片"),
						onClick: async () => {
							await canvas.userActionRegistry.execute("download.image-no-watermark")
						},
					},
				],
				visible: () => {
					return canvas.userActionRegistry.canExecute("download.image")
				},
			}
		: basicDownloadMenuItem

	// 只读模式下只显示复制菜单
	if (readonly) {
		return [copyMenuItem, copyPngMenuItem, { type: "separator" }, downloadMenuItem]
	}

	return [
		copyMenuItem,
		copyPngMenuItem,
		{
			id: "paste",
			label: translate("menu.paste", "粘贴"),
			icon: ClipboardPaste,
			shortcut: getShortcutDisplay("edit.paste"),
			onClick: async () => {
				await canvas.userActionRegistry.execute("edit.paste")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("edit.paste")
			},
		},
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
		{
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
		},
		{
			id: "add-to-new-conversation",
			label: translate("menu.addToNewConversation", "添加至新话题"),
			icon: MessageSquarePlus,
			onClick: async () => {
				await canvas.userActionRegistry.execute("conversation.add-to-new")
			},
			visible: () => {
				return canvas.userActionRegistry.canExecute("conversation.add-to-new")
			},
		},
		{ type: "separator" },
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
