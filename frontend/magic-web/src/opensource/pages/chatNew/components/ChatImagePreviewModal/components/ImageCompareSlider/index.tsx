import { IconCaretLeftRightFilled } from "@tabler/icons-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { Flex } from "antd"

import { useTranslation } from "react-i18next"
import { CompareViewType } from "@/opensource/components/base/MagicImagePreview/constants"
import type { ImagePreviewInfo } from "@/types/chat/preview"
import { useStyles } from "./styles"

interface ImageCompareSliderProps {
	isPressing?: boolean
	viewType?: CompareViewType
	info?: ImagePreviewInfo
}

function ImageCompareSlider(props: ImageCompareSliderProps) {
	const { isPressing, viewType, info } = props
	const { url, oldUrl, fileId, oldFileId } = info || {}

	const { t } = useTranslation("interface")

	const { styles, cx } = useStyles()

	const containerRef = useRef<HTMLDivElement>(null)
	const [sliderPosition, setSliderPosition] = useState(50) // 默认滑块在中间
	const [isDragging, setIsDragging] = useState(false)

	const handlePointerDown = useMemoizedFn((e) => {
		setIsDragging(true)
		e.stopPropagation()
	})

	const handlePointerUp = useMemoizedFn((e) => {
		if (isDragging) setIsDragging(false)
		e.stopPropagation()
	})

	const handleMove = useMemoizedFn((e, clientX) => {
		if (!containerRef.current || !isDragging) return
		const rect = containerRef.current.getBoundingClientRect()
		const offsetX = clientX - rect.left
		const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100)) // 限制范围 0-100%
		setSliderPosition(percentage)
		e.stopPropagation()
	})

	// 捕捉鼠标在外部松开的事件
	useEffect(() => {
		if (!isDragging) return
		const handleGlobalPointerUp = () => {
			if (isDragging) setIsDragging(false)
		}

		window.addEventListener("pointerup", handleGlobalPointerUp)

		// eslint-disable-next-line consistent-return
		return () => {
			window.removeEventListener("pointerup", handleGlobalPointerUp)
		}
	}, [isDragging])

	// 原图
	const oldImg = useMemo(
		() => (
			<div
				className={cx(styles.imageWrapper, {
					[styles.overlay]: viewType === CompareViewType.PULL,
				})}
				style={
					viewType === CompareViewType.PULL
						? {
								width: `${sliderPosition}%`,
						  }
						: {}
				}
			>
				<img src={oldUrl} alt={oldFileId} className={styles.image} draggable="false" />
				<div className={styles.text}>{t("chat.imagePreview.beforeProcessing")}</div>
			</div>
		),
		[
			cx,
			styles.imageWrapper,
			styles.overlay,
			styles.image,
			styles.text,
			viewType,
			sliderPosition,
			oldUrl,
			oldFileId,
			t,
		],
	)

	// 高清图
	const hdImg = useMemo(
		() => (
			<div className={styles.imageWrapper}>
				<img src={url} alt={fileId} className={styles.image} draggable="false" />
				<div className={cx(styles.text, styles.textRight)}>
					{t("chat.imagePreview.afterProcessing")}
				</div>
			</div>
		),
		[styles.imageWrapper, styles.image, styles.text, styles.textRight, url, fileId, cx, t],
	)

	// 滑块
	const slider = useMemo(
		() => (
			<div
				className={styles.slider}
				style={{ left: `${sliderPosition}%` }}
				onPointerDown={handlePointerDown}
			>
				<div className={styles.sliderSplit} />
				<Flex align="center" justify="center" className={styles.sliderHandle}>
					<IconCaretLeftRightFilled size={20} color="currentColor" />
				</Flex>
			</div>
		),
		[handlePointerDown, sliderPosition, styles.slider, styles.sliderHandle, styles.sliderSplit],
	)

	const renderView = useMemo(() => {
		switch (viewType) {
			case CompareViewType.PULL:
				return (
					<>
						{oldImg}
						{hdImg}
						{slider}
					</>
				)
			case CompareViewType.LONG_PRESS:
				return isPressing ? oldImg : hdImg
			default:
				return null
		}
	}, [hdImg, isPressing, oldImg, slider, viewType])

	return (
		<div
			className={styles.container}
			ref={containerRef}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onPointerMove={(e) => handleMove(e, e.clientX)}
		>
			{renderView}
		</div>
	)
}

export default ImageCompareSlider
