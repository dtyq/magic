import { DetailType } from "../../../types"
import type { ActionContext, ViewMode } from "../types"

const DOWNLOADABLE_TYPES = new Set<string>([
	DetailType.Pdf,
	DetailType.Docx,
	DetailType.Html,
	DetailType.Md,
	DetailType.Text,
	DetailType.Code,
	DetailType.Excel,
	DetailType.PowerPoint,
	DetailType.Image,
	DetailType.Video,
	DetailType.Audio,
	DetailType.Design,
	DetailType.NotSupport,
])

const BASIC_ACTION_TYPES = new Set<string>([
	DetailType.Pdf,
	DetailType.Docx,
	DetailType.Excel,
	DetailType.PowerPoint,
	DetailType.Md,
	DetailType.Html,
	DetailType.Code,
	DetailType.Text,
	DetailType.Image,
	DetailType.Video,
	DetailType.Audio,
	DetailType.Design,
	DetailType.NotSupport,
])

export function isDownloadable(type?: string, isFromNode?: boolean): boolean {
	if (isFromNode) return false
	return type ? DOWNLOADABLE_TYPES.has(type) : false
}

export function supportsViewModeToggle(type?: string, isEditMode?: boolean): boolean {
	if (isEditMode) return false
	if (type === DetailType.Md) return true
	if (type === DetailType.Html) return true
	return false
}

export function supportsCopy(type?: string, viewMode?: ViewMode, isFromNode?: boolean): boolean {
	if (isFromNode) return false
	return (
		type === DetailType.Code ||
		type === DetailType.Text ||
		type === DetailType.Md ||
		(type === DetailType.Html && viewMode === "code")
	)
}

export function showBasicActions(type?: string): boolean {
	return type ? BASIC_ACTION_TYPES.has(type) : false
}

export function canShowRefresh(context: ActionContext): boolean {
	return (
		context.detailMode === "files" &&
		context.type !== DetailType.NotSupport &&
		context.isNewestFileVersion &&
		context.showRefreshButton
	)
}

export function canShowDownload(context: ActionContext): boolean {
	return (
		Boolean(context.currentFile?.id) &&
		isDownloadable(context.type, context.isFromNode) &&
		context.showDownload
	)
}

export function canShowShare(context: ActionContext): boolean {
	return (
		Boolean(context.currentFile?.id) &&
		!context.isShareRoute &&
		context.allowEdit &&
		context.isNewestFileVersion
	)
}

export function canShowMore(context: ActionContext): boolean {
	return !context.isMobile && !context.isFromNode && context.detailMode === "files"
}
