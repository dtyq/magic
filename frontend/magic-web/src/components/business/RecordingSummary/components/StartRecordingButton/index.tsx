import { useTranslation } from "react-i18next"
import FlexBox from "@/components/base/FlexBox"
import LoadingIcon from "../LoadingIcon"
import { useStyles } from "./styles"
import { useState, useCallback, useRef, useEffect } from "react"
import MicrophoneIcon from "./MicrophoneIcon"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { SummaryGuideDOMId } from "@/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide"
import { preloadProjectSelector } from "../ProjectSelector/utils/preloadProjectSelector"
import { useIsMobile } from "@/hooks/useIsMobile"

interface StartRecordingButtonProps {
	isLoading?: boolean
	disabled?: boolean
	allowSelectProject?: boolean
	onClick: (mode: "new" | "current") => void
}

function StartRecordingButton({
	isLoading = false,
	disabled = false,
	allowSelectProject = false,
	onClick,
}: StartRecordingButtonProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const displayText = t("recordingSummary.superEditorPanel.button.startRecording")
	const subText = t("recordingSummary.superEditorPanel.button.startFromCurrent")

	const [currentItem, setCurrentItem] = useState<"new" | "current">("new")
	const [bgWidth, setBgWidth] = useState(110)
	const [iconLeftPosition, setIconLeftPosition] = useState(0)
	const [bgLeft, setBgLeft] = useState(0)

	const newItemRef = useRef<HTMLSpanElement>(null)
	const currentItemRef = useRef<HTMLSpanElement>(null)
	const iconContainerRef = useRef<HTMLDivElement>(null)
	const textContainerRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	// Cache measured dimensions
	const dimensionsCache = useRef({
		iconWidth: 0,
		buttonGap: 4, // gap between icon and text container in button
		buttonPaddingLeft: 8, // button's left padding
		bgPaddingLeft: 4, // background's internal left padding
		bgPaddingRight: 10, // background's internal right padding
		bgWidthAdjustment: 20, // width adjustment for background to account for text hover area
		currentItemLeftAdjustment: 10, // left position adjustment for current item
		newItemWidth: 0,
		currentItemWidth: 0,
	})

	const isNewItem = currentItem === "new"

	// Calculate dimensions based on actual layout
	const calculateDimensions = useCallback(() => {
		if (
			!newItemRef.current ||
			!currentItemRef.current ||
			!iconContainerRef.current ||
			!textContainerRef.current ||
			!buttonRef.current
		) {
			return
		}

		// Use offsetLeft to get layout position (not affected by CSS transforms)
		const iconWidth = iconContainerRef.current.offsetWidth
		const newItemWidth = newItemRef.current.offsetWidth
		const currentItemWidth = currentItemRef.current.offsetWidth

		// Get layout positions using offsetLeft (relative to offsetParent)
		// textContainer's offsetLeft relative to button
		const textContainerLeft = textContainerRef.current.offsetLeft
		// newItem and currentItem's offsetLeft relative to textContainer
		const currentItemOffsetLeft = currentItemRef.current.offsetLeft

		// Calculate absolute positions relative to button
		const currentItemLayoutLeft = textContainerLeft + currentItemOffsetLeft

		// Update cache
		dimensionsCache.current.iconWidth = iconWidth
		dimensionsCache.current.newItemWidth = newItemWidth
		dimensionsCache.current.currentItemWidth = currentItemWidth

		const {
			buttonGap,
			buttonPaddingLeft,
			bgPaddingLeft,
			bgPaddingRight,
			bgWidthAdjustment,
			currentItemLeftAdjustment,
		} = dimensionsCache.current

		if (isNewItem) {
			// When hovering "new" item:
			// Background should have internal padding around the content
			const width =
				buttonPaddingLeft +
				bgPaddingLeft +
				iconWidth +
				buttonGap +
				newItemWidth +
				bgPaddingRight -
				bgWidthAdjustment
			// Background left should be: icon position - bgPaddingLeft
			const bgLeft = 0

			// Icon is already at its natural position (buttonPaddingLeft)
			// position: relative with left: 0 means no offset
			const iconRelativeLeft = bgPaddingLeft

			setBgWidth(width)
			setBgLeft(bgLeft)
			setIconLeftPosition(iconRelativeLeft)
		} else {
			// When hovering "current" item:
			// Background should have internal padding around the content
			const width =
				buttonPaddingLeft +
				bgPaddingLeft +
				iconWidth +
				buttonGap +
				currentItemWidth +
				bgPaddingRight -
				bgWidthAdjustment

			// Icon target position: to the left of currentItem by (iconWidth + gap)
			const iconTargetPosition = currentItemLayoutLeft - iconWidth - buttonGap - bgPaddingLeft
			// Background left: icon position - bgPaddingLeft
			const bgLeft = iconTargetPosition - bgPaddingLeft + currentItemLeftAdjustment

			// Icon uses position: relative, so left is relative to its natural position
			// Natural position is buttonPaddingLeft (8px)
			const iconRelativeLeft = iconTargetPosition + currentItemLeftAdjustment

			setBgWidth(width)
			setBgLeft(bgLeft)
			setIconLeftPosition(iconRelativeLeft)
		}
	}, [isNewItem])

	// Initialize dimensions on mount and when text changes
	useEffect(() => {
		// Use requestAnimationFrame to ensure DOM is fully rendered
		const rafId = requestAnimationFrame(() => {
			calculateDimensions()
		})
		return () => cancelAnimationFrame(rafId)
	}, [displayText, subText, calculateDimensions])

	useUpdateEffect(() => {
		if (disabled && currentItem === "current") {
			setCurrentItem("new")
		}
	}, [disabled])

	const handleMouseEnterNew = useMemoizedFn(() => {
		if (disabled) return
		setCurrentItem("new")
	})

	const handleMouseEnterCurrent = useMemoizedFn(() => {
		if (disabled) return
		setCurrentItem("current")
		preloadProjectSelector()
	})

	const handleMouseLeave = useMemoizedFn(() => {
		if (disabled) return
		setCurrentItem("new")
	})

	// Update dimensions when currentItem changes
	useEffect(() => {
		calculateDimensions()
	}, [currentItem, calculateDimensions])

	return (
		<button
			ref={buttonRef}
			className={styles.startButton}
			disabled={disabled}
			onMouseLeave={handleMouseLeave}
			data-testid="recording-editor-start-button"
			data-disabled={disabled}
			data-loading={isLoading}
		>
			<div
				className={styles.currentItemBg}
				style={{
					width: bgWidth,
					left: bgLeft,
				}}
				aria-hidden="true"
				onClick={() => onClick(currentItem)}
				id={SummaryGuideDOMId.StartRecordingButton}
			></div>
			<FlexBox
				ref={iconContainerRef}
				className={styles.startButtonContent}
				style={{
					left: iconLeftPosition,
				}}
				justify="center"
				align="center"
			>
				{isLoading ? (
					<LoadingIcon size={20} style={{ marginRight: 4 }} color="white" />
				) : (
					<MicrophoneIcon />
				)}
			</FlexBox>
			<FlexBox
				ref={textContainerRef}
				className={styles.startButtonContent}
				gap={40}
				align="center"
				justify="center"
			>
				<span
					ref={newItemRef}
					onMouseEnter={handleMouseEnterNew}
					onClick={() => onClick("new")}
					className={cx(
						isNewItem ? styles.activeText : styles.inactiveText,
						disabled && "disabled",
					)}
				>
					{displayText}
				</span>
				{allowSelectProject && (
					<span
						ref={currentItemRef}
						onMouseEnter={handleMouseEnterCurrent}
						onClick={() => onClick("current")}
						className={cx(
							isNewItem ? styles.inactiveText : styles.activeText,
							disabled && "disabled",
						)}
						id={SummaryGuideDOMId.SelectProjectButton}
					>
						{subText}
					</span>
				)}
			</FlexBox>
		</button>
	)
}

function StartRecordingMobileButton({
	isLoading,
	disabled,
	allowSelectProject,
	onClick,
}: StartRecordingButtonProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const displayText = t("recordingSummary.superEditorPanel.button.startRecording")
	const subText = t("recordingSummary.superEditorPanel.button.startFromCurrent")

	const handleClickNew = useMemoizedFn(() => {
		onClick("new")
	})

	const handleClickCurrent = useMemoizedFn(() => {
		preloadProjectSelector()
		onClick("current")
	})

	return (
		<FlexBox align="center" gap={10}>
			<button
				className={cx(styles.startButton, styles.startButtonMobile)}
				disabled={disabled}
				onClick={handleClickNew}
				role="button"
			>
				<FlexBox align="center" gap={4}>
					{isLoading ? (
						<LoadingIcon size={20} style={{ marginRight: 4 }} color="white" />
					) : (
						<MicrophoneIcon />
					)}
					<span>{displayText}</span>
				</FlexBox>
			</button>
			{allowSelectProject && (
				<button disabled={disabled} onClick={handleClickCurrent} role="button">
					<FlexBox align="center" gap={10}>
						<span className={styles.subButtonMobile}>{subText}</span>
					</FlexBox>
				</button>
			)}
		</FlexBox>
	)
}

export default (props: StartRecordingButtonProps) => {
	const isMobile = useIsMobile()
	return isMobile ? (
		<StartRecordingMobileButton {...props} />
	) : (
		<StartRecordingButton {...props} />
	)
}
