import RichTextFillColor from "../components/text/RichTextFillColor/index"
import StrokeColor from "../components/shape/StrokeColor/index"
import SizeEditButton from "../shared/size/SizeEditButton/index"
import FrameCreateButton from "../components/frame/FrameCreateButton/index"
import FrameRemoveButton from "../components/frame/FrameRemoveButton/index"
import FrameDownloadButton from "../components/frame/FrameDownloadButton/index"
import StoryboardVideoBatchButton from "../components/frame/StoryboardVideoBatchButton/index"
import RichTextFontFamily from "../components/text/RichTextFontFamily/index"
import RichTextFontStyle from "../components/text/RichTextFontStyle/index"
import RichTextFontSize from "../components/text/RichTextFontSize/index"
import RichTextTextAlign from "../components/text/RichTextTextAlign/index"
import ElementAlign from "../components/element/ElementAlign/index"
import ElementDistribute from "../components/element/ElementDistribute/index"
import ShapeStyle from "../components/shape/ShapeStyle/index"
import DownloadButton from "../components/common/DownloadButton/index"
import MediaDownloadButton from "../components/common/MediaDownloadButton/index"
import MediaReplaceButton from "../components/common/MediaReplaceButton/index"
import RichTextAdvancedButton from "../components/text/RichTextAdvancedButton/index"
import TextContentOptimizationButton from "../components/text/TextContentOptimizationButton/index"
import ImagePromptExtractionButton from "../components/image/ImagePromptExtractionButton/index"
import ImageConvertHightButton from "../components/image/ImageConvertHightButton/index"
import ImageCropButton from "../components/image/ImageCropButton/index"
import ImageExtendButton from "../components/image/ImageExtendButton/index"
import ImageRemoveBackgroundButton from "../components/image/ImageRemoveBackgroundButton/index"
import ImageEraserButton from "../components/image/ImageEraserButton/index"
import MediaOriginalSizeButton from "../components/common/MediaOriginalSizeButton/index"
import { ElementToolTypeEnum } from "../../../public/props"
import type { ElementToolResolution } from "../../../runtime/element-tools"
import { ElementToolResolutionProvider } from "../model/ElementToolResolutionContext"

function renderElementTool(id: ElementToolResolution["id"]) {
	switch (id) {
		case ElementToolTypeEnum.TextFillColor:
			return <RichTextFillColor />
		case ElementToolTypeEnum.ShapeStrokeColor:
			return <StrokeColor />
		case ElementToolTypeEnum.ElementResize:
			return <SizeEditButton />
		case ElementToolTypeEnum.FrameCreate:
			return <FrameCreateButton />
		case ElementToolTypeEnum.FrameRemove:
			return <FrameRemoveButton />
		case ElementToolTypeEnum.FrameDownload:
			return <FrameDownloadButton />
		case ElementToolTypeEnum.FrameStoryboardVideoBatch:
			return <StoryboardVideoBatchButton />
		case ElementToolTypeEnum.TextFontFamily:
			return <RichTextFontFamily />
		case ElementToolTypeEnum.TextFontStyle:
			return <RichTextFontStyle />
		case ElementToolTypeEnum.TextFontSize:
			return <RichTextFontSize />
		case ElementToolTypeEnum.TextAlign:
			return <RichTextTextAlign />
		case ElementToolTypeEnum.ElementAlign:
			return <ElementAlign />
		case ElementToolTypeEnum.ElementDistribute:
			return <ElementDistribute />
		case ElementToolTypeEnum.ShapeStyle:
			return <ShapeStyle />
		case ElementToolTypeEnum.TextDownload:
			return <DownloadButton />
		case ElementToolTypeEnum.ContentDownload:
			return <MediaDownloadButton />
		case ElementToolTypeEnum.ContentReplace:
			return <MediaReplaceButton />
		case ElementToolTypeEnum.TextAdvanced:
			return <RichTextAdvancedButton />
		case ElementToolTypeEnum.TextContentOptimization:
			return <TextContentOptimizationButton />
		case ElementToolTypeEnum.ContentPromptExtraction:
			return <ImagePromptExtractionButton />
		case ElementToolTypeEnum.ContentEnhance:
			return <ImageConvertHightButton />
		case ElementToolTypeEnum.ContentCrop:
			return <ImageCropButton />
		case ElementToolTypeEnum.ContentExtend:
			return <ImageExtendButton />
		case ElementToolTypeEnum.ContentRemoveBackground:
			return <ImageRemoveBackgroundButton />
		case ElementToolTypeEnum.ContentEraser:
			return <ImageEraserButton />
		case ElementToolTypeEnum.ContentMediaOriginalSize:
			return <MediaOriginalSizeButton />
		default:
			return null
	}
}

export default function TopToolRenderer({ tool }: { tool: ElementToolResolution }) {
	return (
		<ElementToolResolutionProvider tool={tool}>
			{renderElementTool(tool.id)}
		</ElementToolResolutionProvider>
	)
}
