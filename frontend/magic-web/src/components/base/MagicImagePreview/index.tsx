import { Dropdown, Flex, Slider } from "antd"
import type { HTMLAttributes } from "react"
import { useMemo, useRef } from "react"
import {
	IconChevronLeft,
	IconChevronRight,
	IconColumns2,
	IconDownload,
	IconRelationOneToOne,
	IconRotateRectangle,
	IconSquares,
	IconSquareToggle,
	IconZoomIn,
	IconZoomOut,
} from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicSegmented from "@/components/base/MagicSegmented"
import MagicButton from "../MagicButton"
import MagicIcon from "../MagicIcon"
import useScale, {
	scaleToSliderValue,
	sliderValueToScale,
	type WheelZoomChange,
} from "./hooks/useScale"
import useContentFitScale from "./hooks/useContentFitScale"
import useVectorContentLayout from "./hooks/useVectorContentLayout"
import useRotate from "./hooks/useRotate"
import useOffset, { calculateZoomAnchoredOffset } from "./hooks/useOffset"
import useStyles from "./styles"
import { CompareViewType } from "./constants"
import getPreviewContentKey from "./utils/getPreviewContentKey"
import { useDownloadImageMenu } from "@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { observer } from "mobx-react-lite"
import PreviewThemeBoundary from "./PreviewThemeBoundary"

const MAX_SCALE = 10
const SCALE_STEP = 0.1

interface Props extends HTMLAttributes<HTMLImageElement> {
	/** 临时签名地址续期不代表换图，调用方可提供稳定的内容身份。 */
	contentKey?: string
	src?: string
	onNext?: () => void
	onPrev?: () => void
	nextDisabled?: boolean
	prevDisabled?: boolean
	rootClassName?: string
	hasCompare?: boolean
	viewType?: CompareViewType
	onChangeViewType?: (type: CompareViewType) => void
	onLongPressStart?: () => void
	onLongPressEnd?: () => void
	iconSize?: number
	toolContainerClassName?: string
	onDownload?: (mode?: DownloadImageMode) => void
	isAIImage?: boolean
	/** Vector content is resized at layout time to remain sharp while zooming. */
	contentType?: "raster" | "vector"
}

/**
 * 图片预览组件
 */
const MagicImagePreview = (props: Props) => {
	const {
		hasCompare,
		viewType,
		onChangeViewType,
		onLongPressStart,
		onLongPressEnd,
		onNext,
		onPrev,
		nextDisabled,
		prevDisabled,
		children,
		src,
		rootClassName,
		className,
		iconSize = 24,
		toolContainerClassName,
		onDownload,
		isAIImage = false,
		contentType = "raster",
		contentKey,
		...rest
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")

	const containerRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const fitScale = useContentFitScale(contentRef)
	const { offset, getOffset, setOffset } = useOffset(containerRef)

	const handleWheelZoom = useMemoizedFn(
		({ previousScale, nextScale, clientX, clientY }: WheelZoomChange) => {
			const container = containerRef.current
			if (!container || previousScale <= 0) return

			const rect = container.getBoundingClientRect()
			const hasClientPoint = clientX !== 0 || clientY !== 0
			const anchorX = hasClientPoint ? clientX - rect.left - rect.width / 2 : 0
			const anchorY = hasClientPoint ? clientY - rect.top - rect.height / 2 : 0
			const scaleRatio = nextScale / previousScale
			const currentOffset = getOffset()

			// Keep the content below the gesture centroid stationary while scaling,
			// matching the anchored feel of macOS Preview/Photos.
			setOffset(
				calculateZoomAnchoredOffset(currentOffset, { x: anchorX, y: anchorY }, scaleRatio),
			)
		},
	)

	const { scale, transformScale, minScale, addTenPercent, subTenPercent, setScale, resetScale } =
		useScale(containerRef, {
			step: SCALE_STEP,
			maxScale: MAX_SCALE,
			fitScale,
			onWheelZoom: handleWheelZoom,
		})
	const { rotate, rotateImage } = useRotate()
	const previewContentKey = useMemo(
		() => contentKey ?? src ?? getPreviewContentKey(children),
		[contentKey, children, src],
	)
	const isVectorContent = contentType === "vector"
	useVectorContentLayout(contentRef, isVectorContent, scale, previewContentKey)
	const sliderValue = useMemo(
		() => scaleToSliderValue(scale, minScale, MAX_SCALE),
		[minScale, scale],
	)

	const resetPosition = useMemoizedFn(() => {
		setOffset({
			x: 0,
			y: 0,
		})
	})

	// 恢复原图真实物理尺寸（1 个原图像素对应 1 个 CSS 像素）
	const resetToActualSize = useMemoizedFn(() => {
		resetPosition()
		setScale(1)
	})

	// 切换图片后继续保持完整图片适应预览容器的默认体验
	const resetImage = useMemoizedFn(() => {
		resetPosition()
		resetScale()
	})

	/** 切换图片时, 重置图片位置 */
	useUpdateEffect(() => {
		// 如果存在对比模式, 则不重置图片
		if (hasCompare) return
		resetImage()
	}, [previewContentKey])

	const handleSliderChange = useMemoizedFn((value: number) => {
		setScale(sliderValueToScale(value, minScale, MAX_SCALE))
	})

	const segmentedOptions = useMemo(() => {
		return [
			{
				value: CompareViewType.PULL,
				icon: <IconColumns2 size={18} />,
			},
			{
				value: CompareViewType.LONG_PRESS,
				icon: <IconSquares size={18} />,
			},
		]
	}, [])

	const { agreementModal, downloadImageDropdownItems, downloadMenuClick } = useDownloadImageMenu({
		onDownload,
	})

	return (
		<div className={cx(styles.container, rootClassName)}>
			<div ref={containerRef} className={styles.imageDragWrapper}>
				<div
					ref={contentRef}
					className={cx(styles.imageWrapper, className)}
					draggable={false}
					style={{
						transform: isVectorContent
							? `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`
							: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${transformScale})`,
						willChange: isVectorContent ? "auto" : undefined,
						backfaceVisibility: isVectorContent ? "visible" : undefined,
					}}
					{...rest}
				>
					{children}
				</div>
			</div>
			<Flex
				className={cx(styles.toolContainer, toolContainerClassName)}
				align="center"
				gap={12}
			>
				{onPrev && (
					<MagicButton
						type="link"
						className={styles.toolButton}
						onClick={onPrev}
						disabled={prevDisabled}
					>
						<MagicIcon
							color="currentColor"
							component={IconChevronLeft}
							size={iconSize}
						/>
					</MagicButton>
				)}
				{onNext && (
					<MagicButton
						type="link"
						className={styles.toolButton}
						onClick={onNext}
						disabled={nextDisabled}
					>
						<MagicIcon
							color="currentColor"
							component={IconChevronRight}
							size={iconSize}
						/>
					</MagicButton>
				)}
				{(onPrev || onNext) && <div className={styles.divider} />}
				<Flex gap={8} align="center">
					<MagicButton type="link" className={styles.toolButton} onClick={subTenPercent}>
						<MagicIcon color="currentColor" component={IconZoomOut} size={iconSize} />
					</MagicButton>
					<Slider
						className={styles.slider}
						min={0}
						max={100}
						value={sliderValue}
						step={0.5}
						tooltip={{
							open: false,
						}}
						onChange={handleSliderChange}
					/>
					<span className={styles.sliderText}>{Math.round(scale * 100)}%</span>
					<MagicButton type="link" className={styles.toolButton} onClick={addTenPercent}>
						<MagicIcon color="currentColor" component={IconZoomIn} size={iconSize} />
					</MagicButton>
				</Flex>
				{/* 1:1 */}
				<MagicButton type="link" className={styles.toolButton} onClick={resetToActualSize}>
					<MagicIcon
						color="currentColor"
						component={IconRelationOneToOne}
						size={iconSize}
					/>
				</MagicButton>
				{/* 旋转 */}
				<MagicButton type="link" className={styles.toolButton} onClick={rotateImage}>
					<MagicIcon
						color="currentColor"
						component={IconRotateRectangle}
						size={iconSize}
					/>
				</MagicButton>
				{/* 下载 */}
				{onDownload &&
					(isAIImage ? (
						<Dropdown
							menu={{
								rootClassName: styles.moreOperationsDropdown,
								items: downloadImageDropdownItems,
								onClick: downloadMenuClick,
							}}
							trigger={["click"]}
							placement="topRight"
						>
							<MagicButton type="link" className={styles.toolButton}>
								<MagicIcon
									color="currentColor"
									component={IconDownload}
									size={iconSize}
								/>
							</MagicButton>
						</Dropdown>
					) : (
						<MagicButton
							type="link"
							className={styles.toolButton}
							onClick={() => onDownload?.()}
						>
							<MagicIcon
								color="currentColor"
								component={IconDownload}
								size={iconSize}
							/>
						</MagicButton>
					))}
				{hasCompare && (
					<>
						<div className={styles.divider} />
						<MagicSegmented
							options={segmentedOptions}
							className={styles.segmented}
							value={viewType}
							onChange={onChangeViewType}
						/>
					</>
				)}
			</Flex>
			{hasCompare && viewType === CompareViewType.LONG_PRESS && (
				<MagicButton
					type="default"
					className={styles.longPressButton}
					onPointerDown={onLongPressStart}
					onPointerUp={onLongPressEnd}
					onPointerLeave={onLongPressEnd}
				>
					<IconSquareToggle color="currentColor" size={18} />
					{t("chat.imagePreview.longPressCompare")}
				</MagicButton>
			)}
			{agreementModal}
		</div>
	)
}

const ObservedMagicImagePreview = observer(MagicImagePreview)

export default function ImagePreview(props: Props) {
	return (
		<PreviewThemeBoundary>
			<ObservedMagicImagePreview {...props} />
		</PreviewThemeBoundary>
	)
}
