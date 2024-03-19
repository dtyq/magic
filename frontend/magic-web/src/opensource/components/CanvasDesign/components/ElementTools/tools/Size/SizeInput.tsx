import { Input } from "../../../ui/input"
import styles from "./index.module.css"
import { Link2, Unlink2 } from "lucide-react"
import IconButton from "../../../ui/custom/IconButton/index"
import { useCallback, useEffect, useRef, useState } from "react"

export interface SizeInputProps {
	width: number
	height: number
	isLocked?: boolean
	readonly?: boolean
	onWidthChange?: (value: number) => void
	onHeightChange?: (value: number) => void
	onToggleLock?: () => void
	onWidthBlur?: () => void
	onHeightBlur?: () => void
}

export default function SizeInput({
	width,
	height,
	isLocked = false,
	readonly = false,
	onWidthChange,
	onHeightChange,
	onToggleLock,
	onWidthBlur,
	onHeightBlur,
}: SizeInputProps) {
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

	// 处理宽度变化
	const handleWidthChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (readonly) return

			const newValue = e.target.value
			setWidthInput(newValue)

			if (newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 0) {
				// 如果锁定了等比例，同时更新高度
				if (isLocked && aspectRatioRef.current > 0) {
					const newHeight = Math.round(numValue / aspectRatioRef.current)
					setHeightInput(newHeight.toString())
					onHeightChange?.(newHeight)
				}

				onWidthChange?.(numValue)
			}
		},
		[readonly, isLocked, onWidthChange, onHeightChange],
	)

	// 处理高度变化
	const handleHeightChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (readonly) return

			const newValue = e.target.value
			setHeightInput(newValue)

			if (newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 0) {
				// 如果锁定了等比例，同时更新宽度
				if (isLocked && aspectRatioRef.current > 0) {
					const newWidth = Math.round(numValue * aspectRatioRef.current)
					setWidthInput(newWidth.toString())
					onWidthChange?.(newWidth)
				}

				onHeightChange?.(numValue)
			}
		},
		[readonly, isLocked, onWidthChange, onHeightChange],
	)

	// 处理宽度输入框失焦
	const handleWidthBlur = useCallback(() => {
		if (readonly) return

		if (widthInput === "" || Number.isNaN(Number.parseInt(widthInput, 10))) {
			setWidthInput(Math.round(width).toString())
		} else {
			const numValue = Number.parseInt(widthInput, 10)
			if (numValue < 0) {
				setWidthInput("0")
				onWidthChange?.(0)
			}
		}
		onWidthBlur?.()
	}, [readonly, widthInput, width, onWidthChange, onWidthBlur])

	// 处理高度输入框失焦
	const handleHeightBlur = useCallback(() => {
		if (readonly) return

		if (heightInput === "" || Number.isNaN(Number.parseInt(heightInput, 10))) {
			setHeightInput(Math.round(height).toString())
		} else {
			const numValue = Number.parseInt(heightInput, 10)
			if (numValue < 0) {
				setHeightInput("0")
				onHeightChange?.(0)
			}
		}
		onHeightBlur?.()
	}, [readonly, heightInput, height, onHeightChange, onHeightBlur])

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
		<div className={styles.size}>
			<div className={`${styles.inputWrapper} ${readonly ? styles.readonly : ""}`}>
				<span className={styles.label}>宽</span>
				<Input
					className={`${styles.input} ${readonly ? styles.readonly : ""}`}
					type="number"
					min={0}
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
			<div className={`${styles.inputWrapper} ${readonly ? styles.readonly : ""}`}>
				<span className={`${styles.label} ${isLocked || readonly ? styles.disabled : ""}`}>
					高
				</span>
				<Input
					className={`${styles.input} ${readonly ? styles.readonly : ""}`}
					type="number"
					min={0}
					value={heightInput}
					onChange={handleHeightChange}
					onBlur={handleHeightBlur}
					disabled={isLocked || readonly}
				/>
			</div>
		</div>
	)
}
