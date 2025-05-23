import Empty from "./components/DetailEmpty"
import Browser from "./contents/Browser"
import CodeViewer from "./contents/Code"
import HTML from "./contents/HTML"
import TextEditor from "./contents/Md"
import PDFViewer from "./contents/Pdf"
import Search from "./contents/Search"
import Terminal from "./contents/Terminal"
import UniverViewer from "./contents/Univer"
import Image from "./contents/Image"
import type { DetailHTMLData, DetailTerminalData, DetailUniverData } from "./types"
import { DetailType } from "./types"

export default function Render(props: any) {
	const {
		type,
		data,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		isFullscreen,
	} = props

	// 通用属性对象，用于传递给各个内容组件
	const commonProps = {
		type,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		isFullscreen,
	}

	switch (type) {
		case DetailType.Md:
			return <TextEditor data={data} {...commonProps} />
			break
		case DetailType.Browser:
			return <Browser data={data} {...commonProps} />
			break
		case DetailType.Html:
			return <HTML data={data as DetailHTMLData} {...commonProps} />
			break
		case DetailType.Search:
			return <Search data={data} {...commonProps} />
			break
		case DetailType.Terminal:
			return <Terminal data={data as DetailTerminalData} {...commonProps} />
			break
		case DetailType.Text:
			return <TextEditor data={data} {...commonProps} />
			break
		case DetailType.Pdf:
			return <PDFViewer data={data} {...commonProps} />
			break
		case DetailType.Code:
			return (
				<CodeViewer
					data={data}
					file_name={data?.file_name || "代码片段"}
					{...commonProps}
				/>
			)
			break
		case DetailType.Excel:
			return <UniverViewer data={data as DetailUniverData} {...commonProps} />
			break
		// case DetailType.PowerPoint:
		// 	return <UniverViewer data={data as DetailUniverData} {...commonProps} />
		// 	break
		case DetailType.Image:
			return <Image data={data} {...commonProps} />
			break
		default:
			return <Empty text={data?.text} />
	}
}
