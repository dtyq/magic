import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import styles from "./index.module.css"
import IconButton from "../ui/custom/IconButton"
import { ImagePlus, X } from "../ui/icons/index"
import { useMemo, useCallback } from "react"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useMagic } from "../../context/MagicContext"
import ReferenceImageItem from "./ReferenceImageItem"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useCanvas } from "../../context/CanvasContext"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { useCanvasDesignI18n } from "../../context/I18nContext"

interface MessageHistoryRenderProps {
	imageElement: ImageElement
}

export default function MessageHistoryRender(props: MessageHistoryRenderProps) {
	const { imageElement } = props
	const { selectedElements, setMessageHistoryElementId } = useCanvasUI()
	const { imageModelList, convertHightConfig } = useMagic()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()

	// 获取请求信息
	const request = imageElement.generateImageRequest

	// 获取高清请求信息
	const highRequest = imageElement.generateHightImageRequest

	// 获取元素实例以访问 getImageInfo 方法
	const elementInstance = useMemo(() => {
		if (!canvas || !imageElement.id) return undefined
		return canvas.elementManager.getElementInstance(imageElement.id) as
			| ImageElementClass
			| undefined
	}, [canvas, imageElement.id])

	// 获取尺寸
	const sizes = useMemo(() => {
		const result = highRequest?.size || request?.size
		if (result) {
			return result
		}
		const imageInfo = elementInstance?.getImageInfo()
		if (imageInfo) {
			return `${imageInfo.naturalWidth}x${imageInfo.naturalHeight}`
		}
		return undefined
	}, [highRequest?.size, request?.size, elementInstance])

	// 容器位置
	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "message-history",
		enableWheelForwarding: true,
	})

	// 合并 refs
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	// 关闭按钮点击事件
	const handleClose = useCallback(() => {
		setMessageHistoryElementId(null)
	}, [setMessageHistoryElementId])

	// 根据 modelId 查找对应的模型信息
	const modelInfo = useMemo(() => {
		if (!request?.model_id) return undefined
		return imageModelList.find((model) => model.model_id === request?.model_id)
	}, [imageModelList, request?.model_id])

	// 从模型的 image_size_config 或高清图配置中查找匹配的尺寸选项
	const sizeOptionLabel = useMemo(() => {
		if (!sizes) return undefined

		// 如果存在 highRequest，从高清图配置中查找
		if (highRequest) {
			return convertHightConfig?.image_size_config?.sizes.find((item) => {
				return item.value === sizes
			})?.label
		}

		// 否则从模型的 image_size_config 中查找
		return modelInfo?.image_size_config?.sizes.find((item) => {
			const sameSize = item.value === sizes
			if (item.scale !== undefined && request?.resolution !== undefined) {
				return sameSize && item.scale === request?.resolution
			}
			return sameSize
		})?.label
	}, [
		highRequest,
		convertHightConfig?.image_size_config?.sizes,
		modelInfo?.image_size_config?.sizes,
		request?.resolution,
		sizes,
	])

	return (
		<div ref={setRefs} className={styles.messageHistory} data-canvas-ui-component>
			<div className={styles.header}>
				<div className={styles.name}>{t("messageHistory.title", "生成记录")}</div>
				<IconButton className={styles.closeButton} onClick={handleClose}>
					<X size={16} />
				</IconButton>
			</div>
			<div className={styles.divider}></div>
			<div className={styles.body}>
				{/* 提示词 */}
				<div className={styles.item}>
					<div className={styles.itemTitle}>{t("messageHistory.prompt", "提示词")}</div>
					<div className={styles.itemContent}>
						{request?.prompt || t("messageHistory.noPrompt", "暂无提示词")}
					</div>
				</div>

				{/* 参考图 */}
				{!!request?.reference_images?.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceImage", "参考图")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{request?.reference_images?.map((path, index) => {
									return <ReferenceImageItem key={index} path={path} />
								})}
							</div>
						</div>
					</div>
				)}

				{/* 模型 */}
				<div className={styles.item}>
					<div className={styles.itemTitle}>{t("messageHistory.model", "模型")}</div>
					<div className={styles.itemContent}>
						<div className={styles.model}>
							<div className={styles.modelIcon}>
								{modelInfo?.model_icon ? (
									<img
										src={modelInfo.model_icon}
										alt={modelInfo.model_name || request?.model_id}
									/>
								) : (
									<ImagePlus size={16} />
								)}
							</div>
							<div className={styles.modelName}>
								{modelInfo?.model_name || request?.model_id}
							</div>
						</div>
					</div>
				</div>

				{/* 尺寸 */}
				{!!sizes && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>{t("messageHistory.size", "尺寸")}</div>
						<div className={styles.itemContent}>
							<span>
								{sizeOptionLabel} {sizes} {request?.resolution}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
