import { useMemoizedFn } from "ahooks"
import { GlobalSearch } from "@/types/search"
import {
	IconAudioFile,
	IconBiTable,
	IconCompressedFile,
	IconDocFile,
	IconDocxFile,
	IconExcelFile,
	IconFolder,
	IconHtmlFile,
	IconImageFile,
	IconKnowledge,
	IconLinkFile,
	IconMarkdownFile,
	IconMindMaoFile,
	IconOtherFile,
	IconPDFFile,
	IconPPTFile,
	IconSpace,
	IconTextFile,
	IconVideoFile,
	IconWhiteboardFile,
	IconWordFile,
	IconXMindFile,
} from "@/enhance/tabler/icons-react"
import { RouteParams } from "@/routes/history/types"
import { RouteName } from "@/routes/constants"

const size = 40

// 文件类型 统一用GlobalSearch.CloudDriveFileType 区分 0-目录 1-多维表格 2-文档 3-表格 4-思维笔记
const FileIcons: Record<GlobalSearch.CloudDriveFileType, { svgIcon: React.ReactElement }> = {
	[GlobalSearch.CloudDriveFileType.ALL]: {
		svgIcon: <IconSpace size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.FOLDER]: {
		svgIcon: <IconFolder size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.MULTI_TABLE]: {
		svgIcon: <IconBiTable size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.WORD]: {
		svgIcon: <IconWordFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.EXCEL]: {
		svgIcon: <IconExcelFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.MIND_NOTE]: {
		svgIcon: <IconMindMaoFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.PPT]: {
		svgIcon: <IconPPTFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.PDF]: {
		svgIcon: <IconPDFFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.CLOUD_DOCX]: {
		svgIcon: <IconDocxFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.CLOUD_DOC]: {
		svgIcon: <IconDocFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.LINK]: {
		svgIcon: <IconLinkFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.KNOWLEDGE_BASE]: {
		svgIcon: <IconKnowledge size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.IMAGE]: {
		svgIcon: <IconImageFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.VIDEO]: {
		svgIcon: <IconVideoFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.AUDIO]: {
		svgIcon: <IconAudioFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.COMPRESS]: {
		svgIcon: <IconCompressedFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.UNKNOWN]: {
		svgIcon: <IconOtherFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.MARKDOWN]: {
		svgIcon: <IconMarkdownFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.HTML]: {
		svgIcon: <IconHtmlFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.TXT]: {
		svgIcon: <IconTextFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.XMIND]: {
		svgIcon: <IconXMindFile size={size} />,
	},
	[GlobalSearch.CloudDriveFileType.WHITEBOARD]: {
		svgIcon: <IconWhiteboardFile size={size} />,
	},
}

interface FileParserHook {
	file: GlobalSearch.CloudDriveItem
}

function useFileParser({ file }: FileParserHook) {
	/** 获取文件图标 */
	const getFileIcon = useMemoizedFn(() => {
		return (
			FileIcons?.[file.file_type as GlobalSearch.CloudDriveFileType] ??
			FileIcons[GlobalSearch.CloudDriveFileType.UNKNOWN]
		)?.svgIcon
	})

	/** 获取文件地址 */
	const getFileUrl = useMemoizedFn((): RouteParams => {
		switch (file.file_type) {
			case GlobalSearch.CloudDriveFileType.FOLDER:
				return {
					name: RouteName.DriveFolder,
					params: {
						folderId: file.id,
						spaceType: file.space_type,
					},
				}
			case GlobalSearch.CloudDriveFileType.WORD:
			case GlobalSearch.CloudDriveFileType.EXCEL:
			case GlobalSearch.CloudDriveFileType.PPT:
			case GlobalSearch.CloudDriveFileType.PDF:
				return {
					name: RouteName.OfficeFile,
					params: {
						id: file.id,
					},
				}
			case GlobalSearch.CloudDriveFileType.MULTI_TABLE:
				return {
					name: RouteName.BiTable,
					params: {
						tableId: file.id,
					},
				}
			case GlobalSearch.CloudDriveFileType.CLOUD_DOC:
				return {
					name: RouteName.Docs,
					params: {
						fileId: file.id,
					},
				}
			case GlobalSearch.CloudDriveFileType.CLOUD_DOCX:
				return {
					name: RouteName.Docx,
					params: {
						fileId: file.id,
					},
				}
			case GlobalSearch.CloudDriveFileType.KNOWLEDGE_BASE:
				return {
					name: RouteName.KnowledgeDirectory,
					params: {
						knowledgeId: file.id,
					},
				}
			default:
				return {
					name: RouteName.File,
					params: {
						fileId: file.id,
					},
				}
		}
	})

	return {
		getFileUrl,
		getFileIcon,
	}
}

export default useFileParser
