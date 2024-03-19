import {
	IconTextFile,
	IconMarkdownFile,
	IconPDFFile,
	IconExcelFile,
	IconDocxFile,
	IconXMindFile,
	IconOtherFile,
	IconFolder,
	IconPPTFile,
	IconMagicDoc,
	IconMagicTable,
} from "@/opensource/enhance/tabler/icons-react"
import TSIcon from "@/opensource/components/base/TSIcon"
import { Knowledge } from "@/opensource/types/knowledge"

// 文件类型与拓展名的映射
export const fileExtensionMap = {
	TXT: "txt",
	MD: "md",
	PDF: "pdf",
	XLSX: "xlsx",
	XLS: "xls",
	DOCX: "docx",
	CSV: "csv",
	XML: "xml",
}

// 外部文件 - 类型与枚举值的映射
export const externalFileTypeMap = {
	UNKNOWN: 0,
	TXT: 1,
	MD: 2,
	PDF: 3,
	XLSX: 5,
	XLS: 6,
	DOCX: 8,
	CSV: 9,
	XML: 10,
	MAGIC_DOC: 1001,
	MAGIC_TABLE: 1002,
}

// 支持向量知识库嵌入的文件类型，需与后端同步
export const supportedFileExtensions = Object.values(fileExtensionMap)

// 根据文件扩展名获取文件类型图标
export const getFileIconByExt = (extension: string, size = 24) => {
	const map = {
		[fileExtensionMap.TXT]: <IconTextFile size={size} />,
		[fileExtensionMap.MD]: <IconMarkdownFile size={size} />,
		[fileExtensionMap.PDF]: <IconPDFFile size={size} />,
		[fileExtensionMap.XLSX]: <IconExcelFile size={size} />,
		[fileExtensionMap.XLS]: <IconExcelFile size={size} />,
		[fileExtensionMap.DOCX]: <IconDocxFile size={size} />,
		[fileExtensionMap.CSV]: <IconExcelFile size={size} />,
		[fileExtensionMap.XML]: <IconXMindFile size={size} />,
	}
	return map[extension] || <IconOtherFile size={size} />
}

/** 外部文件 - 根据文件类型获取文件icon */
export const getExternalFileIconByType = (type: number, size = 24) => {
	const map = {
		[externalFileTypeMap.UNKNOWN]: <IconOtherFile size={size} />,
		[externalFileTypeMap.TXT]: <IconTextFile size={size} />,
		[externalFileTypeMap.MD]: <IconMarkdownFile size={size} />,
		[externalFileTypeMap.PDF]: <IconPDFFile size={size} />,
		[externalFileTypeMap.XLSX]: <IconExcelFile size={size} />,
		[externalFileTypeMap.XLS]: <IconExcelFile size={size} />,
		[externalFileTypeMap.DOCX]: <IconDocxFile size={size} />,
		[externalFileTypeMap.CSV]: <IconExcelFile size={size} />,
		[externalFileTypeMap.XML]: <IconXMindFile size={size} />,
		[externalFileTypeMap.MAGIC_DOC]: <IconMagicDoc size={size} />,
		[externalFileTypeMap.MAGIC_TABLE]: <IconMagicTable size={size} />,
	}
	return map[type] || <IconOtherFile size={size} />
}

/** 天书文件 - 根据文件类型获取文件icon */
export const getTeamshareFileIcon = (
	type: Knowledge.TeamshareFileCascadeItemFileType,
	size = 14,
) => {
	const sizeString = String(size)
	const map = {
		[Knowledge.TeamshareFileCascadeItemFileType.UNLIMITED]: <IconOtherFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.FOLDER]: <IconFolder size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.MULTI_TABLE]: <IconMagicTable size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.WORD]: <IconDocxFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.EXCEL]: <IconExcelFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.MIND_NOTE]: (
			<TSIcon type="ts-mindmap-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.PPT]: <IconPPTFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.PDF]: <IconPDFFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.OLD_CLOUD_DOCUMENT]: (
			<IconMagicDoc size={size} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.LINK]: (
			<TSIcon type="ts-link-doc" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.KNOWLEDGE_BASE]: (
			<TSIcon type="ts-knowledge-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.IMAGE]: (
			<TSIcon type="ts-image-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.VIDEO]: (
			<TSIcon type="ts-video-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.AUDIO]: (
			<TSIcon type="ts-audio-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.COMPRESS]: (
			<TSIcon type="ts-compressed-files" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.UN_KNOW]: <IconOtherFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.MD]: <IconMarkdownFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.CLOUD_DOCUMENT]: <IconMagicDoc size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.KEEWOOD_PAGE]: <IconOtherFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.KEEWOOD_APPLICATION]: (
			<IconOtherFile size={size} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.WHITE_BOARD]: (
			<TSIcon type="ts-whiteboard-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.CSV]: <IconExcelFile size={size} />,
		[Knowledge.TeamshareFileCascadeItemFileType.MAGIC_APPLICATION]: (
			<IconOtherFile size={size} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.MIND_MAP]: (
			<TSIcon type="ts-xmind-file" size={sizeString} />
		),
		[Knowledge.TeamshareFileCascadeItemFileType.JSON]: (
			<TSIcon type="ts-html" size={sizeString} />
		),
	}
	return (map as Record<number, React.ReactNode>)[type] || <IconOtherFile size={size} />
}

export const getFileIconByFileType = (
	type: Knowledge.CreateKnowledgeFileType,
	fileType: Knowledge.TeamshareFileCascadeItemFileType,
	size = 14,
) => {
	if (type === Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE) {
		return getExternalFileIconByType(fileType, size)
	} else if (type === Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE) {
		return getTeamshareFileIcon(fileType, size)
	}
	return <IconOtherFile size={size} />
}

/** 用于判断文档的唯一key */
export const getDocumentKey = (type?: Knowledge.CreateKnowledgeFileType) => {
	if (type === Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE) {
		return "key"
	} else if (type === Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE) {
		return "third_file_id"
	}
	return "key"
}

/** 文档同步状态映射 */
export enum documentSyncStatusMap {
	/** 未同步 */
	Pending = 0,
	/** 已同步 */
	Success = 1,
	/** 同步失败 */
	Failed = 2,
	/** 同步中 */
	Processing = 3,
	/** 删除成功 */
	Deleted = 4,
	/** 删除失败 */
	DeleteFailed = 5,
	/** 重建中 */
	Rebuilding = 6,
}

/** 知识库支持嵌入的文件类型 */
export const SUPPORTED_EMBED_FILE_TYPES =
	"text/plain,text/markdown,.md,.markdown,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/xml"

/** 知识库类型 */
export enum knowledgeType {
	/** 用户自建知识库 */
	UserKnowledgeDatabase = 1,
	/** 天书知识库 */
	TeamshareKnowledgeDatabase = 2,
}

/** 文档操作类型枚举 */
export enum DocumentOperationType {
	ENABLE = "enable",
	DISABLE = "disable",
	DELETE = "delete",
}

/** 分段模式 */
export enum SegmentationMode {
	/** 通用模式 */
	General = 1,
	/** 父子分段 */
	ParentChild = 2,
}

/** 父块模式 */
export enum ParentBlockMode {
	/** 段落 */
	Paragraph = 1,
	/** 全文 */
	FullText = 2,
}

/** 文本预处理规则 */
export enum TextPreprocessingRules {
	/** 替换掉连续的空格、换行符和制表符 */
	ReplaceSpaces = 1,
	/** 删除所有 URL 和电子邮件地址 */
	RemoveUrls = 2,
}

/** 检索方法 */
export enum RetrievalMethod {
	/** 语义检索 */
	SemanticSearch = "semantic_search",
	/** 全文检索 */
	FullTextSearch = "full_text_search",
	/** 混合检索 */
	HybridSearch = "hybrid_search",
	/** 图检索 */
	GraphSearch = "graph_search",
}

/** 数据源类型 */
export enum DataSourceType {
	/** 本地文件 */
	Local = 1,
	/** 企业知识库 */
	Enterprise = 1001,
}
