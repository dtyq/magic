import { Divider, ElementToolTypeEnum } from "../../types"
import ElementToolsRender from "./ElementToolsRender"
import { useMemo } from "react"
import type { ElementToolOptionType } from "./types"
import { ElementTypeEnum } from "../../canvas/types"
import { useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvas } from "../../context/CanvasContext"
import useShowVideoOriginalSizeButton from "./hooks/useShowVideoOriginalSizeButton"

export default function ElementTools() {
	const { convertHightConfig } = useMagic()
	const { canvas } = useCanvas()

	const { selectedElements, isDragging, isSelecting, subElementTooltip } = useCanvasSelectionUI()

	const [firstSelectedElement] = selectedElements

	const isSingleElement = selectedElements.length === 1

	const imageSrc =
		firstSelectedElement?.type === ElementTypeEnum.Image ? firstSelectedElement.src : undefined

	const showVideoOriginalSizeButton = useShowVideoOriginalSizeButton({
		canvas,
		isSingleElement,
		elementType: firstSelectedElement?.type,
		elementId: firstSelectedElement?.id,
		videoSrc:
			firstSelectedElement?.type === ElementTypeEnum.Video
				? firstSelectedElement.src
				: undefined,
		elementWidth: firstSelectedElement?.width,
		elementHeight: firstSelectedElement?.height,
	})

	const options: ElementToolOptionType[] = useMemo(() => {
		const hideToolsWhileTransform =
			isDragging && !(isSingleElement && firstSelectedElement?.type === ElementTypeEnum.Text)
		if (!selectedElements.length || hideToolsWhileTransform || isSelecting) return []

		if (selectedElements.some((el) => el.locked === true)) return []

		if (subElementTooltip) {
			return [{ type: subElementTooltip }]
		}

		if (isSingleElement) {
			switch (firstSelectedElement?.type) {
				case ElementTypeEnum.Text:
					return [
						{ type: ElementToolTypeEnum.RichTextFillColor },
						Divider,
						{ type: ElementToolTypeEnum.RichTextFontFamily },
						{ type: ElementToolTypeEnum.RichTextFontSize },
						Divider,
						{ type: ElementToolTypeEnum.RichTextFontStyle },
						Divider,
						{ type: ElementToolTypeEnum.RichTextTextAlign },
						Divider,
						{ type: ElementToolTypeEnum.RichTextAdvancedButton },
						Divider,
						{ type: ElementToolTypeEnum.DownloadButton },
					]

				case ElementTypeEnum.Frame:
					return [
						{ type: ElementToolTypeEnum.FrameRemoveButton },
						Divider,
						{ type: ElementToolTypeEnum.SizeEditButton },
						Divider,
						{ type: ElementToolTypeEnum.ElementAlign },
						{ type: ElementToolTypeEnum.ElementDistribute },
					]

				case ElementTypeEnum.Image:
					if (!imageSrc) return []
					const imageElementTools: ElementToolOptionType[] = []
					imageElementTools.push({
						type: ElementToolTypeEnum.SizeEditButton,
					})
					imageElementTools.push(Divider)
					imageElementTools.push({
						type: ElementToolTypeEnum.ImageCropButton,
					})
					// imageElementTools.push({
					// 	type: ElementToolTypeEnum.ImageExtendButton,
					// })
					imageElementTools.push({
						type: ElementToolTypeEnum.ImageRemoveBackgroundButton,
					})
					// imageElementTools.push({
					// 	type: ElementToolTypeEnum.ImageEraserButton,
					// })
					if (convertHightConfig?.supported) {
						// imageElementTools.push(Divider)
						imageElementTools.push({
							type: ElementToolTypeEnum.ImageConvertHightButton,
						})
					}
					return imageElementTools

				case ElementTypeEnum.Video:
					return showVideoOriginalSizeButton
						? [{ type: ElementToolTypeEnum.VideoOriginalSizeButton }]
						: []

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
		return []
	}, [
		convertHightConfig?.supported,
		firstSelectedElement?.type,
		imageSrc,
		isDragging,
		isSelecting,
		isSingleElement,
		selectedElements,
		showVideoOriginalSizeButton,
		subElementTooltip,
	])

	if (!options.length) {
		return null
	}

	return <ElementToolsRender options={options} />
}
