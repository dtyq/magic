import { createStyles } from "antd-style"
import type { CSSProperties } from "react"

export const useStyles = createStyles(
	(
		{ css, prefixCls, token, isDarkMode },
		{ justify }: { justify?: CSSProperties["justifyContent"] },
	) => ({
		magicButton: css`
			display: flex;
			align-items: center;
			justify-content: ${justify};
			box-shadow: none;

      .${prefixCls}-btn-icon { 
				display: flex;
				align-items: center;
				justify-content: center;
			}

			--${prefixCls}-button-default-hover-color: ${token.colorText} !important;
			--${prefixCls}-button-default-hover-border-color: ${token.colorBorder} !important;
			--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.fill[0]} !important;
			--${prefixCls}-button-default-bg: ${
			isDarkMode ? token.magicColorUsages.bg[1] : token.colorWhite
		} !important;
			--${prefixCls}-button-default-color: ${token.colorTextSecondary} !important;
		`,
	}),
)
