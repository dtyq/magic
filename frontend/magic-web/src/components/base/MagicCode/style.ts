import { createStyles, cx, css } from "antd-style"

export const useStyles = createStyles(({ isDarkMode, prefixCls, token }) => {
	const copy = cx(css`
		padding: 6px 8px;
		height: 28px;
		position: absolute;
		right: 6px;
		top: 6px;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 6px;
		background: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorUsages.white};
		cursor: pointer;
		z-index: 10;

		/* iOS Safari 兼容性样式 */
		-webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		touch-action: manipulation;

		&:hover {
			background: ${isDarkMode
				? token.magicColorScales.grey[4]
				: token.magicColorScales.grey[1]} !important;
		}

		&:active {
			background: ${isDarkMode
				? token.magicColorScales.grey[5]
				: token.magicColorScales.grey[0]} !important;
		}

		/* 针对触摸设备的额外样式 */
		@media (hover: none) and (pointer: coarse) {
			/* 在触摸设备上，确保按钮始终可见 */
			opacity: 1;
			visibility: visible;

			&:active {
				transform: scale(0.95);
				transition: transform 0.1s ease;
			}
		}

		box-shadow:
			0px 4px 14px 0px rgba(0, 0, 0, 0.05),
			0px 0px 1px 0px rgba(0, 0, 0, 0.15);
		gap: 4px;

		.${prefixCls}-btn-icon {
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`)

	return {
		container: css`
			position: relative;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${isDarkMode
				? token.magicColorScales.grey[2]
				: token.magicColorUsages.white};

			pre::-webkit-scrollbar {
				display: none;
			}
		`,
		inner: {
			"> pre": {
				background: "transparent !important",
				padding: "10px 16px",
				margin: 0,
			},
		},
		raw: css`
			background: transparent !important;
			border: none !important;
			color: ${token.colorText};
			margin: 10px;
		`,
		copy,
	}
})
