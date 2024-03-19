import { lazy } from "react"
import type { DetailHTMLData, DetailTerminalData, DetailUniverData } from "../../types"
import { DetailType } from "../../types"
import { hasPPTMetadata, isFileInPPTMode } from "../../utils/file"

// Lazy load all content components
const Empty = lazy(() => import("../DetailEmpty"))
const Browser = lazy(() => import("../../contents/Browser"))
const CodeViewer = lazy(() => import("../../contents/Code"))
const HTML = lazy(() => import("../../contents/HTML"))
const TextEditor = lazy(() => import("../../contents/Md"))
const PDFViewer = lazy(() => import("../../contents/Pdf"))
const Search = lazy(() => import("../../contents/Search"))
const Terminal = lazy(() => import("../../contents/Terminal"))
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
	// console.log("ContentRenderer:", type, data, commonProps)

	// 在 playbackTab 中，除了 FileTree、Browser、Search、Terminal，其他类型都不需要显示 CommonHeader
	const { isPlaybackMode, showFileHeader: originalShowFileHeader } = commonProps
	const typesWithHeader = [DetailType.Browser, DetailType.Search, DetailType.Terminal]
	const showFileHeader = isPlaybackMode ? typesWithHeader.includes(type) : originalShowFileHeader

	commonProps = {
		...commonProps,
		showFileHeader,
	}

	switch (type) {
		case DetailType.Md:
			return <TextEditor data={data} {...commonProps} />
		case DetailType.Browser:
			return <Browser data={data} {...commonProps} />
		case DetailType.Html:
			if (hasPPTMetadata(data)) {
				return <PPTRootRender data={data} {...commonProps} />
			}

			const isInPPTMode = isFileInPPTMode(data.file_id, commonProps.attachmentList)

			return <HTML data={data as DetailHTMLData} isInPPTMode={isInPPTMode} {...commonProps} />
		case DetailType.Search:
			return <Search data={data} {...commonProps} />
		case DetailType.Terminal:
			return <Terminal data={data as DetailTerminalData} {...commonProps} />
		case DetailType.Text:
			return <Text data={data} {...commonProps} />
		case DetailType.Pdf:
			return <PDFViewer data={data} {...commonProps} />
		case DetailType.Code:
			return (
				<CodeViewer
					data={data}
					file_name={data?.file_name || "代码片段"}
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
