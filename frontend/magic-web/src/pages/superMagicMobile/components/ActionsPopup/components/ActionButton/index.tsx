import { memo, useCallback } from "react"
import { createStyles } from "antd-style"

// Types
import type { ActionsPopup } from "../../types"

const useStyles = createStyles(({ token, css }) => {
	return {
		actionButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 50px;
			padding: 0 16px;
			border: none;
			background: transparent;
			border-bottom: 1px solid ${token.magicColorUsages?.border || "rgba(28, 29, 35, 0.08)"};
			cursor: pointer;
			transition: background-color 0.2s;
			width: 100%;

			&:hover {
				background-color: ${token.magicColorUsages?.bg?.[1] || "#F9F9F9"};
			}

			&:active {
				background-color: ${token.magicColorUsages?.bg?.[2] || "#F0F0F0"};
			}

			&:disabled {
				cursor: not-allowed;
				opacity: 0.5;
			}
		`,

		buttonText: css`
			font-size: 16px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages?.text?.[1] || "#1C1D23"};
		`,

		// 危险按钮样式
		dangerButton: css`
			color: ${"#FF4D4F"};
		`,

		disabledText: css`
			color: ${token.magicColorUsages?.text?.[3] || "#A0A0A0"};
		`,
	}
})

/**
 * ActionButton - 操作按钮组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
function ActionButton(props: ActionsPopup.ActionButtonProps) {
	const { label, onClick, variant = "default", disabled = false } = props
	const { styles } = useStyles()

	const handleClick = useCallback(() => {
		if (!disabled && onClick) {
			onClick()
		}
	}, [disabled, onClick])

	const textClassName = [
		styles.buttonText,
		variant === "danger" && styles.dangerButton,
		disabled && styles.disabledText,
	]
		.filter(Boolean)
		.join(" ")

	return (
		<button
			className={styles.actionButton}
			onClick={handleClick}
			disabled={disabled}
			type="button"
		>
			<span className={textClassName}>{label}</span>
		</button>
	)
}

ActionButton.displayName = "ActionButton"

export default memo(ActionButton)
