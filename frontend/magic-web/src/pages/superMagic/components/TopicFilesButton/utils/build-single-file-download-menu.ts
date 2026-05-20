import { message } from "antd"
import { isConvertibleFile } from "@/pages/superMagic/components/Detail/utils/file"
import { IMAGE_EXTENSIONS } from "@/pages/superMagic/components/Detail/hooks/useDetailActions"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "../hooks/types"
import type { TFunction } from "i18next"
import { AttachmentSource } from "../hooks/types"

export interface MobileDownloadMenuItem {
	key: string
	label: string
	children?: MobileDownloadMenuItem[]
	onClick?: () => void
}

/** Menu key for AI image no-watermark download; used for preload timing on desktop/mobile. */
export const DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY = "downloadImageNoWaterMark"

/** Whether a menu tree exposes the no-watermark download action (any depth). */
export function menuItemsIncludeNoWaterMarkDownload(items: MobileDownloadMenuItem[]): boolean {
	for (const item of items) {
		if (item.key === DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY) return true
		if (item.children?.length && menuItemsIncludeNoWaterMarkDownload(item.children)) return true
	}
	return false
}

export interface SingleFileDownloadHandlers {
	handleDownloadOriginal: (item: AttachmentItem, mode?: DownloadImageMode) => void
	handleDownloadPdf: (
		item: AttachmentItem,
		folderChildren?: AttachmentItem[],
		pagination?: "slice" | "none",
	) => void
	handleDownloadPpt: (item: AttachmentItem) => void
	handleDownloadPptx: (item: AttachmentItem, folderChildren?: AttachmentItem[]) => void
	handleDownloadImage?: (item: AttachmentItem, format: "png" | "jpeg") => void
	handleDownloadNoWaterMark?: (item: AttachmentItem) => void
	preloadWaterMarkFreeModal?: () => void
}

export interface BuildSingleFileDownloadMenuOptions {
	item: AttachmentItem
	handlers: SingleFileDownloadHandlers
	t: TFunction
	shouldUseSingleDownloadEntry?: boolean
	isFreeTrialVersion?: boolean
}

/** Check whether extension is treated as an image for AI download submenu rules. */
function isImageExtension(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const ext = fileExtension.toLowerCase()
	return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * Single source of truth for per-file download options (mobile sheet + useContextMenu).
 * Business handlers must come from useFileOperations; this module only decides visibility/structure.
 */
export function buildSingleFileDownloadMenu({
	item,
	handlers,
	t,
	shouldUseSingleDownloadEntry = false,
}: BuildSingleFileDownloadMenuOptions): MobileDownloadMenuItem[] {
	const {
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleDownloadPptx,
		handleDownloadImage,
		handleDownloadNoWaterMark,
	} = handlers

	// Slide folder: download subtree with entry-file resolution
	if (item.is_directory && item.display_config?.type === "slide") {
		return [
			{
				key: "downloadOriginal",
				label: t("topicFiles.contextMenu.downloadOriginal"),
				onClick: () => handleDownloadOriginal(item),
			},
			{
				key: "downloadPdf",
				label: t("topicFiles.contextMenu.downloadPdf"),
				onClick: () => handleDownloadPdf(item, item.children || []),
			},
			{
				key: "downloadPpt",
				label: t("topicFiles.contextMenu.downloadPpt"),
				onClick: () => {
					const appEntryFile = getAppEntryFile(item.children || [], item.display_config)
					if (appEntryFile) handleDownloadPpt(appEntryFile)
					else if (item.display_config?.type === "custom")
						message.error(t("topicFiles.customMainFileNotFound"))
				},
			},
			{
				key: "downloadPptx",
				label: t("topicFiles.contextMenu.downloadPptx"),
				onClick: () => {
					const children = item.children || []
					const appEntryFile = getAppEntryFile(children, item.display_config)
					if (appEntryFile) handleDownloadPptx(appEntryFile, children)
					else if (item.display_config?.type === "custom")
						message.error(t("topicFiles.customMainFileNotFound"))
				},
			},
		]
	}

	if (item.is_directory) {
		return [
			{
				key: "downloadFolder",
				label: t("topicFiles.contextMenu.downloadFolder"),
				onClick: () => handleDownloadOriginal(item),
			},
		]
	}

	const canConvertToPdf = isConvertibleFile(item, ["html", "md"])
	const canConvertToPPTX = isConvertibleFile(item, ["html"])
	const canConvertToImage = isConvertibleFile(item, [
		"html",
		"md",
		"txt",
		"log",
		"js",
		"jsx",
		"ts",
		"tsx",
		"css",
		"scss",
		"json",
		"py",
		"java",
		"c",
		"cpp",
		"cs",
		"go",
		"rb",
		"php",
		"swift",
		"kt",
		"rs",
		"sh",
		"sass",
		"less",
		"styl",
		"sql",
		"vue",
		"svelte",
		"dart",
		"r",
		"scala",
		"clj",
		"ex",
		"lua",
		"yaml",
		"yml",
		"toml",
		"ini",
		"xml",
		"dockerfile",
	])

	if (canConvertToPdf || canConvertToPPTX || canConvertToImage) {
		const items: MobileDownloadMenuItem[] = [
			{
				key: "downloadOriginal",
				label: t("topicFiles.contextMenu.downloadOriginal"),
				onClick: () => handleDownloadOriginal(item, DownloadImageMode.Download),
			},
		]

		if (canConvertToPdf) {
			items.push({
				key: "downloadPdf",
				label: t("topicFiles.contextMenu.downloadPdf"),
				children: [
					{
						key: "downloadPdfPaginated",
						label: t("topicFiles.exportPdfPaginated"),
						onClick: () => handleDownloadPdf(item, undefined, "slice"),
					},
					{
						key: "downloadPdfFullPage",
						label: t("topicFiles.exportPdfFullPage"),
						onClick: () => handleDownloadPdf(item, undefined, "none"),
					},
				],
			})
		}

		if (canConvertToPPTX) {
			items.push(
				{
					key: "downloadPpt",
					label: t("topicFiles.contextMenu.downloadPpt"),
					onClick: () => handleDownloadPpt(item),
				},
				{
					key: "downloadPptx",
					label: t("topicFiles.contextMenu.downloadPptx"),
					onClick: () => handleDownloadPptx(item, item.children || []),
				},
			)
		}

		if (canConvertToImage && handleDownloadImage) {
			items.push({
				key: "downloadAsImage",
				label: t("topicFiles.contextMenu.downloadAsImage"),
				children: [
					{
						key: "downloadImagePng",
						label: t("topicFiles.exportImagePng"),
						onClick: () => handleDownloadImage(item, "png"),
					},
					{
						key: "downloadImageJpeg",
						label: t("topicFiles.exportImageJpeg"),
						onClick: () => handleDownloadImage(item, "jpeg"),
					},
				],
			})
		}

		return items
	}

	const isAIImageFile =
		isImageExtension(item.file_extension) && item.source === AttachmentSource.AI

	if (isAIImageFile && !shouldUseSingleDownloadEntry) {
		return [
			{
				key: "downloadImage",
				label: t("topicFiles.contextMenu.downloadImage"),
				onClick: () => handleDownloadOriginal(item, DownloadImageMode.NormalDownload),
			},
			{
				key: DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY,
				label: t("topicFiles.contextMenu.downloadImageNoWaterMark"),
				onClick: () => handleDownloadNoWaterMark?.(item),
			},
		]
	}

	return [
		{
			key: "downloadOriginal",
			label: t("topicFiles.contextMenu.downloadOriginal"),
			onClick: () => {
				if (isAIImageFile && shouldUseSingleDownloadEntry) {
					handleDownloadNoWaterMark?.(item)
					return
				}
				handleDownloadOriginal(item, DownloadImageMode.Download)
			},
		},
	]
}
