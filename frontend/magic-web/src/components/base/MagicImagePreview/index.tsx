import { Dropdown, Flex, Slider } from "antd"
import type { HTMLAttributes } from "react"
import { memo, useMemo, useRef } from "react"
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
import useScale from "./hooks/useScale"
import useRotate from "./hooks/useRotate"
import useOffset from "./hooks/useOffset"
import useStyles from "./styles"
import { CompareViewType } from "./constants"
import { useDownloadImageMenu } from "@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { observer } from "mobx-react-lite"

const MAX_SCALE = 5
const SCALE_STEP = 0.1

interface Props extends HTMLAttributes<HTMLImageElement> {
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
		rootClassName,
		className,
		iconSize = 24,
		toolContainerClassName,
		onDownload,
		isAIImage = false,
		...rest
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")

	const containerRef = useRef<HTMLDivElement>(null)

	const { scale, addTenPercent, subTenPercent, setScale } = useScale(containerRef, {
		step: SCALE_STEP,
		maxScale: MAX_SCALE,
	})
	const { rotate, rotateImage } = useRotate()

	const { offset, setOffset } = useOffset(containerRef)

	// 重置图片
	const resetImage = useMemoizedFn(() => {
		setOffset({
			x: 0,
			y: 0,
		})
		setScale(1)
	})

	/** 切换图片时, 重置图片位置 */
	useUpdateEffect(() => {
		// 如果存在对比模式, 则不重置图片
		if (hasCompare) return
		resetImage()
	}, [children])

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
					className={cx(styles.imageWrapper, className)}
					draggable={false}
					style={{
						transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${scale})`,
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
						min={0.1}
						max={MAX_SCALE}
						defaultValue={1}
						value={scale}
						step={SCALE_STEP}
						tooltip={{
							open: false,
						}}
						onChange={setScale}
					/>
					<span className={styles.sliderText}>{Math.round(scale * 100)}%</span>
					<MagicButton type="link" className={styles.toolButton} onClick={addTenPercent}>
						<MagicIcon color="currentColor" component={IconZoomIn} size={iconSize} />
					</MagicButton>
				</Flex>
				{/* 1:1 */}
				<MagicButton type="link" className={styles.toolButton} onClick={resetImage}>
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

export default observer(MagicImagePreview)
