import { Input, Alert } from "antd"
import { forwardRef, useRef } from "react"
import type { InputRef, InputProps } from "antd"
import { useStyles } from "../style"

export interface InputWithErrorProps extends InputProps {
	errorMessage?: string
	showError?: boolean
	height?: number
}

const InputWithError = forwardRef<InputRef, InputWithErrorProps>(function InputWithError(
	{ errorMessage, showError = false, style, height = 20, ...props },
	ref,
) {
	const { styles } = useStyles({ isExpanded: true })
	const isComposingRef = useRef(false)

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
	}

	const handleDragStart = (e: React.DragEvent) => {
		// 只阻止非文本选择的拖拽事件冒泡
		// 如果是文本选择拖拽,允许其正常进行但阻止冒泡
		e.stopPropagation()
	}

	const handleCompositionStart = () => {
		isComposingRef.current = true
	}

	const handleCompositionEnd = () => {
		isComposingRef.current = false
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// 如果正在使用输入法输入（如中文拼音），阻止回车事件冒泡
		if (e.key === "Enter" && isComposingRef.current) {
			e.stopPropagation()
			return
		}
		// 调用原始的 onKeyDown
		props.onKeyDown?.(e)
	}

	return (
		<div style={{ flex: 1, position: "relative" }}>
			<Input
				ref={ref}
				{...props}
				style={{
					height: `${height}px`,
					fontSize: "13px",
					...style,
				}}
				status={errorMessage ? "error" : undefined}
				onDrop={handleDrop}
				onDragStart={handleDragStart}
				onCompositionStart={handleCompositionStart}
				onCompositionEnd={handleCompositionEnd}
				onKeyDown={handleKeyDown}
				draggable={false}
			/>
			{showError && errorMessage && (
				<div className={styles.errorMessage} style={{ top: `${height}px` }}>
					<Alert message={errorMessage} type="error" />
				</div>
			)}
		</div>
	)
})

export default InputWithError
