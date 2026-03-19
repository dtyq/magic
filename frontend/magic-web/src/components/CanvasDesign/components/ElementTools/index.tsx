import { Divider, ElementToolTypeEnum } from "../../types"
import ElementToolsRender from "./ElementToolsRender"
import { useMemo } from "react"
import type { ElementToolOptionType } from "./types"
import { ElementTypeEnum } from "../../canvas/types"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useMagic } from "../../context/MagicContext"

export default function ElementTools() {
	const { convertHightConfig } = useMagic()

	const { selectedElements, isDragging, isSelecting, subElementTooltip } = useCanvasUI()

	const [firstSelectedElement] = selectedElements

	const isSingleElement = selectedElements.length === 1

	const imageSrc =
		firstSelectedElement?.type === ElementTypeEnum.Image ? firstSelectedElement.src : undefined

	const options: ElementToolOptionType[] = useMemo(() => {
		if (!selectedElements.length || isDragging || isSelecting) return []

		if (subElementTooltip) {
			return [{ type: subElementTooltip }]
		}

		if (isSingleElement) {
			switch (firstSelectedElement?.type) {
				case ElementTypeEnum.Text:
					return [
						{ type: ElementToolTypeEnum.FillColor },
						{ type: ElementToolTypeEnum.StrokeColor },
						Divider,
						{ type: ElementToolTypeEnum.FontFamily },
						{ type: ElementToolTypeEnum.FontStyle },
						{ type: ElementToolTypeEnum.FontSize },
						{ type: ElementToolTypeEnum.TextAlign },
						Divider,
						{ type: ElementToolTypeEnum.TextAdvancedButton },
					]

				case ElementTypeEnum.Frame:
					return [
						{ type: ElementToolTypeEnum.FrameRemoveButton },
						Divider,
						{ type: ElementToolTypeEnum.SizeSelect },
						Divider,
						{ type: ElementToolTypeEnum.Size },
						Divider,
						{ type: ElementToolTypeEnum.ElementAlign },
						{ type: ElementToolTypeEnum.ElementDistribute },
					]

				case ElementTypeEnum.Image:
					if (!imageSrc) return []
					const imageElementTools: ElementToolOptionType[] = [
						{ type: ElementToolTypeEnum.SizeSelect },
						Divider,
						{ type: ElementToolTypeEnum.Size },
					]
					if (convertHightConfig?.supported) {
						imageElementTools.push(Divider)
						imageElementTools.push({
							type: ElementToolTypeEnum.ImageConvertHightButton,
						})
					}
					return imageElementTools

				default:
					break
			}
		} else {
			if (!selectedElements.find((element) => element.type === ElementTypeEnum.Frame)) {
				return [
					{ type: ElementToolTypeEnum.FrameCreateButton },
					Divider,
					{ type: ElementToolTypeEnum.ElementAlign },
					{ type: ElementToolTypeEnum.ElementDistribute },
				]
			} else {
				return [
					{ type: ElementToolTypeEnum.ElementAlign },
					{ type: ElementToolTypeEnum.ElementDistribute },
				]
			}
		}

		// return [
		// 	{ type: ElementToolTypeEnum.FillColor },
		// 	{ type: ElementToolTypeEnum.StrokeColor },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.FrameCreateButton },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.FrameSizeSelect },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.Size },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.FontFamily },
		// 	{ type: ElementToolTypeEnum.FontStyle },
		// 	{ type: ElementToolTypeEnum.FontSize },
		// 	{ type: ElementToolTypeEnum.TextAlign },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.ElementAlign },
		// 	{ type: ElementToolTypeEnum.ElementDistribute },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.ShapeStyle },
		// 	Divider,
		// 	{ type: ElementToolTypeEnum.DownloadButton },
		// ]
		return []
	}, [
		convertHightConfig?.supported,
		firstSelectedElement?.type,
		imageSrc,
		isDragging,
		isSelecting,
		isSingleElement,
		selectedElements,
		subElementTooltip,
	])

	if (!options.length) {
		return null
	}

	return <ElementToolsRender options={options} />
}
