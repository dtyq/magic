import { Input } from "../../../ui/input"
import styles from "./index.module.css"
import { Link2, Unlink2 } from "lucide-react"
import IconButton from "../../../ui/custom/IconButton/index"
import { useCallback, useEffect, useRef, useState } from "react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export interface SizeInputProps {
	width: number
	height: number
	isLocked?: boolean
	isAutoFill?: boolean
	readonly?: boolean
	maxWidth?: number
	maxHeight?: number
	onWidthChange?: (value: number) => void
	onHeightChange?: (value: number) => void
	onToggleLock?: () => void
	onWidthBlur?: () => void
	onHeightBlur?: () => void
	/** 为 true 时，输入过程中即提交数值（受控草稿）；默认仅在失焦时提交 */
	commitOnInput?: boolean
}

export default function SizeInput({
	width,
	height,
	isLocked = false,
	isAutoFill = false,
	readonly = false,
	maxWidth,
	maxHeight,
	onWidthChange,
	onHeightChange,
	onToggleLock,
	onWidthBlur,
	onHeightBlur,
	commitOnInput = false,
}: SizeInputProps) {
	const { t } = useCanvasDesignI18n()
	// 本地输入框值状态
	const [widthInput, setWidthInput] = useState<string>("")
	const [heightInput, setHeightInput] = useState<string>("")

	// 保存初始宽高比
	const aspectRatioRef = useRef<number>(1)

	// 同步宽高到输入框
	useEffect(() => {
		setWidthInput(Math.round(width).toString())
		setHeightInput(Math.round(height).toString())
		// 更新宽高比
		if (width > 0 && height > 0) {
			aspectRatioRef.current = width / height
		}
	}, [width, height])

	const applyWidthCommit = useCallback(
		(numValue: number) => {
			let finalWidth = numValue < 0 ? 0 : numValue
			if (maxWidth !== undefined && finalWidth > maxWidth) {
				finalWidth = maxWidth
				setWidthInput(maxWidth.toString())
			} else if (numValue < 0) {
				finalWidth = 0
				setWidthInput("0")
			}

			onWidthChange?.(finalWidth)

			if (isLocked && aspectRatioRef.current > 0) {
				const newHeight = Math.round(finalWidth / aspectRatioRef.current)
				const finalHeight =
					maxHeight !== undefined ? Math.min(newHeight, maxHeight) : newHeight
				setHeightInput(finalHeight.toString())
				onHeightChange?.(finalHeight)
			}
		},
		[maxWidth, maxHeight, isLocked, onWidthChange, onHeightChange],
	)

	const applyHeightCommit = useCallback(
		(numValue: number) => {
			let finalHeight = numValue < 0 ? 0 : numValue
			if (maxHeight !== undefined && finalHeight > maxHeight) {
				finalHeight = maxHeight
				setHeightInput(maxHeight.toString())
			} else if (numValue < 0) {
				finalHeight = 0
				setHeightInput("0")
			}

			onHeightChange?.(finalHeight)

			if (isLocked && aspectRatioRef.current > 0) {
				const newWidth = Math.round(finalHeight * aspectRatioRef.current)
				const finalWidth = maxWidth !== undefined ? Math.min(newWidth, maxWidth) : newWidth
				setWidthInput(finalWidth.toString())
				onWidthChange?.(finalWidth)
			}
		},
		[maxWidth, maxHeight, isLocked, onWidthChange, onHeightChange],
	)

	// 处理宽度变化
	const handleWidthChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (readonly) return

			const newValue = e.target.value
			setWidthInput(newValue)

			if (commitOnInput && newValue !== "" && !Number.isNaN(Number.parseInt(newValue, 10))) {
				applyWidthCommit(Number.parseInt(newValue, 10))
			}
		},
		[readonly, commitOnInput, applyWidthCommit],
	)

	// 处理高度变化
	const handleHeightChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (readonly) return

			const newValue = e.target.value
			setHeightInput(newValue)

			if (commitOnInput && newValue !== "" && !Number.isNaN(Number.parseInt(newValue, 10))) {
				applyHeightCommit(Number.parseInt(newValue, 10))
			}
		},
		[readonly, commitOnInput, applyHeightCommit],
	)

	// 处理宽度输入框失焦（未开启 commitOnInput 时在此提交）
	const handleWidthBlur = useCallback(() => {
		if (readonly) return

		if (widthInput === "" || Number.isNaN(Number.parseInt(widthInput, 10))) {
			setWidthInput(Math.round(width).toString())
		} else {
			applyWidthCommit(Number.parseInt(widthInput, 10))
		}
		onWidthBlur?.()
	}, [readonly, widthInput, width, applyWidthCommit, onWidthBlur])

	// 处理高度输入框失焦
	const handleHeightBlur = useCallback(() => {
		if (readonly) return

		if (heightInput === "" || Number.isNaN(Number.parseInt(heightInput, 10))) {
			setHeightInput(Math.round(height).toString())
		} else {
			applyHeightCommit(Number.parseInt(heightInput, 10))
		}
		onHeightBlur?.()
	}, [readonly, heightInput, height, applyHeightCommit, onHeightBlur])

	// 切换锁定状态
	const handleToggleLock = useCallback(() => {
		if (readonly) return

		// 更新当前的宽高比
		if (width > 0 && height > 0) {
			aspectRatioRef.current = width / height
		}

		onToggleLock?.()
	}, [readonly, width, height, onToggleLock])

	return (
		<div className={`${styles.size} ${isAutoFill ? styles.autoFill : ""}`}>
			<div
				className={`${styles.inputWrapper} ${readonly ? styles.readonly : ""} ${
					isAutoFill ? styles.autoFillWrapper : ""
				}`}
			>
				<span className={styles.label}>{t("elementTools.size.width", "宽")}</span>
				<Input
					className={`${styles.input} ${readonly ? styles.readonly : ""}`}
					type="number"
					min={0}
					max={maxWidth}
					value={widthInput}
					onChange={handleWidthChange}
					onBlur={handleWidthBlur}
					readOnly={readonly}
					disabled={readonly}
				/>
			</div>
			{!readonly && (
				<IconButton className={styles.link} onClick={handleToggleLock} selected={isLocked}>
					{isLocked ? <Link2 size={16} /> : <Unlink2 size={16} />}
				</IconButton>
			)}
			<div
				className={`${styles.inputWrapper} ${readonly ? styles.readonly : ""} ${
					isAutoFill ? styles.autoFillWrapper : ""
				}`}
			>
				<span className={`${styles.label} ${readonly ? styles.disabled : ""}`}>
					{t("elementTools.size.height", "高")}
				</span>
				<Input
					className={`${styles.input} ${readonly ? styles.readonly : ""}`}
					type="number"
					min={0}
					max={maxHeight}
					value={heightInput}
					onChange={handleHeightChange}
					onBlur={handleHeightBlur}
					readOnly={readonly}
					disabled={readonly}
				/>
			</div>
		</div>
	)
}
