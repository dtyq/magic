import FillColor from "./tools/FillColor"
import StrokeColor from "./tools/StrokeColor"
import Size from "./tools/Size"
import SizeSelect from "./tools/SizeSelect"
import FrameCreateButton from "./tools/FrameCreateButton"
import FrameRemoveButton from "./tools/FrameRemoveButton"
import FontFamily from "./tools/FontFamily"
import FontStyle from "./tools/FontStyle"
import FontSize from "./tools/FontSize"
import TextAlign from "./tools/TextAlign"
import ElementAlign from "./tools/ElementAlign"
import ElementDistribute from "./tools/ElementDistribute"
import ShapeStyle from "./tools/ShapeStyle"
import DownloadButton from "./tools/DownloadButton"
import TextAdvancedButton from "./tools/TextAdvancedButton"
import ImageConvertHightButton from "./tools/ImageConvertHightButton"
import ImageConvertHight from "./tools/ImageConvertHight"
import { ElementToolTypeEnum } from "../../types"
import type { ElementToolType } from "../../types"

export default function ElementToolItem({ type }: { type: ElementToolType }) {
	switch (type) {
		case ElementToolTypeEnum.FillColor:
			return <FillColor />
		case ElementToolTypeEnum.StrokeColor:
			return <StrokeColor />
		case ElementToolTypeEnum.Size:
			return <Size />
		case ElementToolTypeEnum.SizeSelect:
			return <SizeSelect />
		case ElementToolTypeEnum.FrameCreateButton:
			return <FrameCreateButton />
		case ElementToolTypeEnum.FrameRemoveButton:
			return <FrameRemoveButton />
		case ElementToolTypeEnum.FontFamily:
			return <FontFamily />
		case ElementToolTypeEnum.FontStyle:
			return <FontStyle />
		case ElementToolTypeEnum.FontSize:
			return <FontSize />
		case ElementToolTypeEnum.TextAlign:
			return <TextAlign />
		case ElementToolTypeEnum.ElementAlign:
			return <ElementAlign />
		case ElementToolTypeEnum.ElementDistribute:
			return <ElementDistribute />
		case ElementToolTypeEnum.ShapeStyle:
			return <ShapeStyle />
		case ElementToolTypeEnum.DownloadButton:
			return <DownloadButton />
		case ElementToolTypeEnum.TextAdvancedButton:
			return <TextAdvancedButton />
		case ElementToolTypeEnum.ImageConvertHightButton:
			return <ImageConvertHightButton />
		case ElementToolTypeEnum.ImageConvertHight:
			return <ImageConvertHight />
		default:
			return null
	}
}
