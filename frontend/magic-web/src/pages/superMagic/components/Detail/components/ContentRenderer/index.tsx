import { lazy } from "react"
import type {
	DetailHTMLData,
	DetailScriptExecutionData,
	DetailTerminalData,
	DetailUniverData,
} from "../../types"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { DetailType } from "../../types"
import {
	isFileInSlideCanvasMode,
	shouldUseAudioRootRender,
	shouldUsePPTRootRender,
} from "../../utils/file"
import type { CodeViewerExtensionContext } from "../../contents/Code"
import { isDesignMagicProjectFile } from "../../contents/Design/utils/isDesignMagicProjectFile"

// Lazy load all content components
const UserTextPreview = lazy(() => import("../../../UserSpace/UserTextPreview"))
const Empty = lazy(() => import("../DetailEmpty"))
const Browser = lazy(() => import("../../contents/Browser"))
const CodeViewer = lazy(() => import("../../contents/Code"))
const MagicProjectCodeInspector = lazy(
	() => import("../../contents/Design/components/MagicProjectCodeInspector"),
)
const HTML = lazy(() => import("../../contents/HTML"))
const TextEditor = lazy(() => import("../../contents/Md"))
const PDFViewer = lazy(() => import("../../contents/Pdf"))
const Search = lazy(() => import("../../contents/Search"))
const KnowledgeSearch = lazy(() => import("../../contents/KnowledgeSearch"))
const Terminal = lazy(() => import("../../contents/Terminal"))
const ScriptExecution = lazy(() => import("../../contents/ScriptExecution"))
const OnlyOfficeViewer = lazy(() => import("../../contents/OnlyOffice"))
const OfficePreview = lazy(() => import("../../contents/OfficePreview"))
const Image = lazy(() => import("../../contents/Image"))
const Text = lazy(() => import("../../contents/Text"))
const NotSupportPreview = lazy(() => import("../../contents/NotSupportPreview"))
const FileTree = lazy(() => import("../../contents/FileTree"))
const Deleted = lazy(() => import("../Deleted"))
const Video = lazy(() => import("../../contents/Video"))
const Audio = lazy(() => import("../../contents/Audio"))
const Design = lazy(() => import("../../contents/Design"))
const PPTRootRender = lazy(() => import("../PPTRootRender"))
const SlidesTemplateRootRender = lazy(() => import("../SlidesTemplateRootRender"))
const SelfMediaRootRender = lazy(() => import("../SelfMediaRootRender"))
const AICardRootRender = lazy(() => import("../AICardRootRender"))
const AudioRootRender = lazy(() => import("../AudioRootRender"))

let RenderOffice: any = null
if (localStorage.getItem("office_preview") === "onlyoffice") {
	RenderOffice = OnlyOfficeViewer
} else {
	RenderOffice = OfficePreview
}

interface ContentRendererProps {
	type: DetailType
	data: any
	commonProps: any
}

function ContentRenderer({ type, data, commonProps }: ContentRendererProps) {
	const fileAccess = useFileAccess()
	// console.log("ContentRenderer:", type, data, commonProps)

	// 在 playbackTab 中，工具执行详情需要保留公共标题栏，其它文件预览不显示该标题栏。
	const { isPlaybackMode, showFileHeader: originalShowFileHeader } = commonProps
	const typesWithHeader = [
		DetailType.Browser,
		DetailType.Search,
		DetailType.Terminal,
		DetailType.ScriptExecution,
	]
	const showFileHeader = isPlaybackMode ? typesWithHeader.includes(type) : originalShowFileHeader

	commonProps = {
		...commonProps,
		showFileHeader,
		// Keep legacy share callers hidden while allowing runtime surfaces to opt in explicitly.
		showRefresh: commonProps.showRefresh ?? !commonProps.isShareRoute,
	}

	// 回收站文本使用绑定的只读文件接口，不进入活跃个人文件的编辑／冲突会话。
	if (
		fileAccess?.kind !== "recycle-bin" &&
		(data?.space_type === "user" || data?.file_reference?.space_type === "user")
	) {
		if ([DetailType.Md, DetailType.Text, DetailType.Code].includes(type)) {
			return <UserTextPreview data={data} {...commonProps} />
		}
		commonProps = { ...commonProps, allowEdit: false }
	}

	switch (type) {
		case DetailType.Md:
			return <TextEditor data={data} {...commonProps} />
		case DetailType.Browser:
			return <Browser data={data} {...commonProps} />
		case DetailType.Html:
			if (shouldUseAudioRootRender(type, data)) {
				return <AudioRootRender data={data} {...commonProps} />
			}
			if (shouldUsePPTRootRender(type, data)) {
				return <PPTRootRender data={data} {...commonProps} />
			}

			const isInPPTMode =
				commonProps.isHtmlSlideCanvasMode ??
				isFileInSlideCanvasMode(data.file_id, commonProps.attachmentList)

			return <HTML data={data as DetailHTMLData} isInPPTMode={isInPPTMode} {...commonProps} />
		case DetailType.SlidesTemplate:
			return <SlidesTemplateRootRender data={data} {...commonProps} />
		case DetailType.Search:
			return <Search data={data} {...commonProps} />
		case DetailType.KnowledgeSearch:
			return <KnowledgeSearch data={data} {...commonProps} />
		case DetailType.Terminal:
			return <Terminal data={data as DetailTerminalData} {...commonProps} />
		case DetailType.ScriptExecution:
			return <ScriptExecution data={data as DetailScriptExecutionData} {...commonProps} />
		case DetailType.Text:
			return <Text data={data} {...commonProps} />
		case DetailType.Pdf:
			return <PDFViewer data={data} {...commonProps} />
		case DetailType.Code:
			const renderExtensions = (options: CodeViewerExtensionContext) => {
				const { fileName, content, displayContent, scopeRef } = options
				const isDesignMagicProjectFileResult = isDesignMagicProjectFile({
					file: data,
					fileName,
					attachments: commonProps.attachments,
					flatAttachments: commonProps.attachmentList,
				})
				return isDesignMagicProjectFileResult ? (
					<MagicProjectCodeInspector
						fileName={fileName}
						content={content}
						fallbackContent={displayContent}
						scopeRef={scopeRef}
					/>
				) : null
			}
			return (
				<CodeViewer
					data={data}
					file_name={data?.file_name || "代码片段"}
					renderExtensions={renderExtensions}
					{...commonProps}
				/>
			)
		case DetailType.Docx: {
			return (
				<RenderOffice
					data={data as DetailUniverData}
					{...commonProps}
					type={DetailType.Docx}
					file_extension={data?.file_extension || "docx"}
				/>
			)
		}
		case DetailType.Doc: {
			return (
				<RenderOffice
					data={data as DetailUniverData}
					{...commonProps}
					type={DetailType.Docx}
					file_extension={data?.file_extension || "doc"}
				/>
			)
		}
		case DetailType.Excel: {
			return (
				<RenderOffice
					data={data as DetailUniverData}
					{...commonProps}
					type={DetailType.Excel}
					file_extension={data?.file_extension || "xlsx"}
				/>
			)
		}
		case DetailType.PowerPoint: {
			return (
				<RenderOffice
					data={data as DetailUniverData}
					{...commonProps}
					type={DetailType.PowerPoint}
					file_extension={data?.file_extension || "pptx"}
				/>
			)
		}
		case DetailType.Image:
			return <Image data={data} {...commonProps} />
		case DetailType.Video:
			return <Video data={data} {...commonProps} />
		case DetailType.Audio:
			return <Audio data={data} {...commonProps} />
		case DetailType.Design:
			return <Design data={data} {...commonProps} />
		case DetailType.SelfMedia:
			return <SelfMediaRootRender data={data} {...commonProps} />
		case DetailType.AICard:
			return <AICardRootRender data={data} {...commonProps} />
		case DetailType.FileTree:
			return <FileTree data={data} {...commonProps} />
		case DetailType.Deleted:
			return <Deleted data={data} {...commonProps} />
		case DetailType.NotSupport:
			return <NotSupportPreview data={data} {...commonProps} />
		default:
			return <Empty />
	}
}

export default ContentRenderer
