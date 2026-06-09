import { createStyles } from "antd-style"
import type { CSSProperties } from "react"

export const useStyles = createStyles(
	(
		{ prefixCls, token, css, isDarkMode },
		{ justify }: { justify: CSSProperties["justifyContent"] },
	) => {
		return {
			magicButton: css`
			display: flex;
			align-items: center;
			justify-content: ${justify};
			gap: 4px;
			box-shadow: none;
			padding: 6px 12px;
			border-radius: 8px;

			--${prefixCls}-button-text-text-color: ${token.magicColorUsages.text[1]} !important;

			--${prefixCls}-button-default-hover-border-color: ${token.colorBorder} !important;
			--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.fill[0]} !important;
			--${prefixCls}-button-default-hover-color: ${token.magicColorUsages.text[1]} !important;
			
			--${prefixCls}-button-default-bg: ${isDarkMode ? token.magicColorUsages.bg[1] : token.colorWhite} !important;
			--${prefixCls}-button-default-border-color: ${token.magicColorUsages.border};
			--${prefixCls}-button-default-color: ${token.magicColorUsages.text[1]} !important;

			
			--${prefixCls}-button-default-active-color: ${token.magicColorUsages.text[1]} !important;
			--${prefixCls}-button-default-active-border-color: ${token.magicColorUsages.border} !important;
			--${prefixCls}-button-default-active-bg: ${token.magicColorUsages.fill[1]} !important;

			.${prefixCls}-btn-icon {
				display: flex;
				align-items: center;
				justify-content: center;
			}

		`,
			link: css`
			padding: 0 !important;
			border: none;
			--${prefixCls}-button-default-color: ${token.magicColorUsages.primary.default} !important;
			--${prefixCls}-button-text-color: ${token.magicColorUsages.primary.default} !important;
			--${prefixCls}-button-text-hover-color: ${token.magicColorUsages.primary.hover} !important;
			--${prefixCls}-button-text-active-color: ${token.magicColorUsages.primary.active} !important;
			--${prefixCls}-button-default-hover-bg: transparent !important;
			&:hover {
				background-color: transparent;
			}
		`,
		}
	},
)
