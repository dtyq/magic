import type { IconParkIconElement } from "@/opensource/components/base/TSIcon"
import { DriveItemFileType, DriveSpaceType } from "@/types/drive"

export const enum DriveSpaceKey {
	Me = "me",
	Shared = "shared",
}

export const DRIVE_SPACE_VALUE_MAP: Record<DriveSpaceKey, DriveSpaceType> = {
	[DriveSpaceKey.Me]: DriveSpaceType.Me,
	[DriveSpaceKey.Shared]: DriveSpaceType.Shared,
}

export const DRIVE_SPACE_KEY_MAP = {
	[DriveSpaceType.Me]: DriveSpaceKey.Me,
	[DriveSpaceType.Shared]: DriveSpaceKey.Shared,
}

/**
 * 可预览文件扩展名
 */
export const PREVIEW_EXTENSIONS = ["pdf", "xls", "xlsx"]

/** 图片扩展名 */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "gif", "webp", "svg", "svg+xml"]
/** 视频扩展名 */
export const VIDEO_EXTENSIONS = ["mp4", "mov", "avi"]

// 附件TS-ICON转换
export const EXTENSION_ICON_MAP: Record<string, IconParkIconElement["name"]> = {
	png: "ts-image-file",
	jpg: "ts-image-file",
	svg: "ts-image-file",
	jpeg: "ts-image-file",
	gif: "ts-image-file",
	webp: "ts-image-file",
	xls: "ts-execl-file",
	XLS: "ts-execl-file",
	xlsx: "ts-execl-file",
	XLSX: "ts-execl-file",
	doc: "ts-word-file",
	DOC: "ts-word-file",
	docx: "ts-word-file",
	DOCX: "ts-word-file",
	ppt: "ts-ppt-file",
	PPT: "ts-ppt-file",
	pptx: "ts-ppt-file",
	PPTX: "ts-ppt-file",
	pdf: "ts-pdf-file",
	PDF: "ts-pdf-file",
	mp4: "ts-video-file",
	avi: "ts-video-file",
	wmv: "ts-video-file",
	mpg: "ts-video-file",
	mpeg: "ts-video-file",
	mov: "ts-video-file",
	mp3: "ts-audio-file",
	wav: "ts-audio-file",
	wma: "ts-audio-file",
	amr: "ts-audio-file",
	rar: "ts-rar-file",
	zip: "ts-zip-file",
	gz: "ts-compressed-files",
	md: "ts-md",
	txt: "ts-txt",
	html: "ts-html",
	css: "ts-html",
	js: "ts-html",
	jsx: "ts-html",
	ts: "ts-html",
	tsx: "ts-html",
	php: "ts-html",
	java: "ts-html",
	vue: "ts-html",
	py: "ts-html",
	sql: "ts-html",
	json: "ts-html",
	xml: "ts-html",
	yaml: "ts-html",
	vb: "ts-html",
	vbs: "ts-html",
	conf: "ts-html",
	jsp: "ts-html",
	xmind: "ts-xmind-file",
	FILE_OTHER: "ts-other-file",
	default: "ts-other-file",
	tldr: "ts-whiteboard-file",
}

// 文件类型 统一用file_type 区分 0-目录 1-多维表格 2-文档 3-表格 4-思维笔记
export const FILE_TYPE_ICON_MAP: Record<
	DriveItemFileType,
	{ svgIcon: IconParkIconElement["name"]; shareIcon?: string; type: DriveItemFileType }
> = {
	[DriveItemFileType.ALL]: {
		svgIcon: "ts-folder",
		shareIcon: "ts-sharefolder",
		type: DriveItemFileType.ALL,
	},
	[DriveItemFileType.FOLDER]: {
		svgIcon: "ts-folder",
		shareIcon: "ts-sharefolder",
		type: DriveItemFileType.FOLDER,
	},
	[DriveItemFileType.MULTI_TABLE]: {
		svgIcon: "ts-bitable-file",
		type: DriveItemFileType.MULTI_TABLE,
	},
	[DriveItemFileType.WORD]: {
		svgIcon: "ts-word-file",
		type: DriveItemFileType.WORD,
	},
	[DriveItemFileType.EXCEL]: {
		svgIcon: "ts-execl-file",
		type: DriveItemFileType.EXCEL,
	},
	[DriveItemFileType.MIND_NOTE]: {
		svgIcon: "ts-mindmap-file",
		type: DriveItemFileType.MIND_NOTE,
	},
	[DriveItemFileType.PPT]: {
		svgIcon: "ts-ppt-file",
		type: DriveItemFileType.PPT,
	},
	[DriveItemFileType.PDF]: {
		svgIcon: "ts-pdf-file",
		type: DriveItemFileType.PDF,
	},
	[DriveItemFileType.CLOUD_DOCX]: {
		svgIcon: "ts-docx-file",
		type: DriveItemFileType.CLOUD_DOCX,
	},
	[DriveItemFileType.CLOUD_DOC]: {
		svgIcon: "ts-doc-file",
		type: DriveItemFileType.CLOUD_DOC,
	},
	[DriveItemFileType.LINK]: {
		svgIcon: "ts-link-doc",
		type: DriveItemFileType.LINK,
	},
	[DriveItemFileType.KNOWLEDGE_BASE]: {
		svgIcon: "ts-knowledge-file",
		type: DriveItemFileType.KNOWLEDGE_BASE,
	},
	[DriveItemFileType.IMAGE]: {
		svgIcon: "ts-image-file",
		type: DriveItemFileType.IMAGE,
	},
	[DriveItemFileType.VIDEO]: {
		svgIcon: "ts-video-file",
		type: DriveItemFileType.VIDEO,
	},
	[DriveItemFileType.AUDIO]: {
		svgIcon: "ts-audio-file",
		type: DriveItemFileType.AUDIO,
	},
	[DriveItemFileType.COMPRESS]: {
		svgIcon: "ts-compressed-files",
		type: DriveItemFileType.COMPRESS,
	},
	[DriveItemFileType.UNKNOWN]: {
		svgIcon: "ts-other-file",
		type: DriveItemFileType.UNKNOWN,
	},
	[DriveItemFileType.MARKDOWN]: {
		svgIcon: "ts-md",
		type: DriveItemFileType.MARKDOWN,
	},
	[DriveItemFileType.HTML]: {
		svgIcon: "ts-html",
		type: DriveItemFileType.HTML,
	},
	[DriveItemFileType.TXT]: {
		svgIcon: "ts-txt",
		type: DriveItemFileType.TXT,
	},
	[DriveItemFileType.XMIND]: {
		svgIcon: "ts-xmind-file",
		type: DriveItemFileType.XMIND,
	},
	[DriveItemFileType.WHITEBOARD]: {
		svgIcon: "ts-whiteboard-file",
		type: DriveItemFileType.WHITEBOARD,
	},
	[DriveItemFileType.APPLICATION]: {
		svgIcon: "ts-folder",
		type: DriveItemFileType.APPLICATION,
	},
	[DriveItemFileType.PAGE]: {
		svgIcon: "ts-folder",
		type: DriveItemFileType.PAGE,
	},
}
