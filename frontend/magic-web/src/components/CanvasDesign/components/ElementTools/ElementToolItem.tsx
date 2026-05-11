import RichTextFillColor from "./tools/RichTextFillColor"
import StrokeColor from "./tools/StrokeColor"
import SizeEditButton from "./tools/SizeEditButton"
import FrameCreateButton from "./tools/FrameCreateButton"
import FrameRemoveButton from "./tools/FrameRemoveButton"
import RichTextFontFamily from "./tools/RichTextFontFamily"
import RichTextFontStyle from "./tools/RichTextFontStyle"
import RichTextFontSize from "./tools/RichTextFontSize"
import RichTextTextAlign from "./tools/RichTextTextAlign"
import ElementAlign from "./tools/ElementAlign"
import ElementDistribute from "./tools/ElementDistribute"
import ShapeStyle from "./tools/ShapeStyle"
import DownloadButton from "./tools/DownloadButton"
import RichTextAdvancedButton from "./tools/RichTextAdvancedButton"
import ImageConvertHightButton from "./tools/ImageConvertHightButton"
import ImageConvertHight from "./tools/ImageConvertHight"
import ImageCropButton from "./tools/ImageCropButton"
import ImageExtendButton from "./tools/ImageExtendButton"
import ImageRemoveBackgroundButton from "./tools/ImageRemoveBackgroundButton"
import ImageEraserButton from "./tools/ImageEraserButton"
import VideoOriginalSizeButton from "./tools/VideoOriginalSizeButton"
import { ElementToolTypeEnum } from "../../types"
import type { ElementToolType } from "../../types"

export default function ElementToolItem({ type }: { type: ElementToolType }) {
	switch (type) {
		case ElementToolTypeEnum.RichTextFillColor:
			return <RichTextFillColor />
		case ElementToolTypeEnum.StrokeColor:
			return <StrokeColor />
		case ElementToolTypeEnum.SizeEditButton:
			return <SizeEditButton />
		case ElementToolTypeEnum.FrameCreateButton:
			return <FrameCreateButton />
		case ElementToolTypeEnum.FrameRemoveButton:
			return <FrameRemoveButton />
		case ElementToolTypeEnum.RichTextFontFamily:
			return <RichTextFontFamily />
		case ElementToolTypeEnum.RichTextFontStyle:
			return <RichTextFontStyle />
		case ElementToolTypeEnum.RichTextFontSize:
			return <RichTextFontSize />
		case ElementToolTypeEnum.RichTextTextAlign:
			return <RichTextTextAlign />
		case ElementToolTypeEnum.ElementAlign:
			return <ElementAlign />
		case ElementToolTypeEnum.ElementDistribute:
			return <ElementDistribute />
		case ElementToolTypeEnum.ShapeStyle:
			return <ShapeStyle />
		case ElementToolTypeEnum.DownloadButton:
			return <DownloadButton />
		case ElementToolTypeEnum.RichTextAdvancedButton:
			return <RichTextAdvancedButton />
		case ElementToolTypeEnum.ImageConvertHightButton:
			return <ImageConvertHightButton />
		case ElementToolTypeEnum.ImageConvertHight:
			return <ImageConvertHight />
		case ElementToolTypeEnum.ImageCropButton:
			return <ImageCropButton />
		case ElementToolTypeEnum.ImageExtendButton:
			return <ImageExtendButton />
		case ElementToolTypeEnum.ImageRemoveBackgroundButton:
			return <ImageRemoveBackgroundButton />
		case ElementToolTypeEnum.ImageEraserButton:
			return <ImageEraserButton />
		case ElementToolTypeEnum.VideoOriginalSizeButton:
			return <VideoOriginalSizeButton />
		default:
			return null
	}
}
