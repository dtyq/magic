import { createStyles } from "antd-style"
import { DEFAULT_FONT_SIZE_BASE } from "@/constants/style"

export const useModernStyles = createStyles(
	({ isDarkMode, css, token }, { disabled = false }: { disabled?: boolean }) => {
		return {
			marginSelection: css`
				margin: 24px;
				position: relative;
				max-width: 720px;
				width: 100%;
				border-radius: 12px;
				overflow: hidden;
				background-color: ${isDarkMode
					? token.magicColorScales.grey[0]
					: token.magicColorUsages.white};
				box-shadow:
					0px 4px 14px 0px rgba(0, 0, 0, 0.1),
					0px 0px 1px 0px rgba(0, 0, 0, 0.3);
				user-select: none;
			`,
			main: css`
				padding: 14px;

				${disabled
					? `
          pointer-events: none;
          opacity: 0.5;
        `
					: ""}
				user-select: none;
			`,
			extra: css`
				padding: 14px;
				background-color: ${isDarkMode
					? token.magicColorScales.grey[6]
					: token.magicColorScales.grey[0]};
				user-select: none;
			`,
			input: css`
				position: relative;
				flex-grow: 1;
				outline: none;
				border: none;
				font-size: ${DEFAULT_FONT_SIZE_BASE}px;
				word-break: break-all;
				overflow: auto;
				white-space: pre-wrap;
				display: flex;
				align-items: center;
				letter-spacing: 0.25;
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[0]};
				user-select: text;
			`,
			sendButton: css`
				padding-left: 8px;
				padding-right: 8px;
				gap: 4px;
				border: none;
			`,
			placeholder: css`
				color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text};
				position: absolute;
				top: 22px;
				left: 18px;
				letter-spacing: 0.25;
			`,
			footer: css`
				width: 100%;
				margin-left: auto;
				padding: 8px 14px 14px 14px;
			`,
			returnButton: css`
				border-radius: 100px;
				color: ${token.magicColorUsages.text[1]};
			`,
		}
	},
)

export const useStandardStyles = createStyles(
	({ css, isDarkMode, prefixCls, token }, { disabled = false }: { disabled?: boolean }) => {
		return {
			container: css`
				width: 100%;
				height: 100%;
				border-top: 1px solid ${token.colorBorder};
				${disabled
					? `
          pointer-events: none;
          opacity: 0.5;
        `
					: ""}
				user-select: none;
			`,
			main: css`
				background-color: ${token.magicColorScales.grey[0]};
				height: 100%;
				border-top: 1px solid ${token.colorBorder};
				user-select: none;
			`,
			input: css`
				flex: 1;
				width: 100%;
				padding: 0 14px;
				box-sizing: border-box;
				min-height: auto;
				outline-style: none;
				position: relative;
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[0]};
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
				overflow-y: auto;
				overflow-x: hidden;
				max-height: 50vh;
				min-height: 40px;
				user-select: text;
			`,
			button: css`
        --${prefixCls}-margin-xs: 2px;
        --${prefixCls}-button-text-hover-bg: ${token.magicColorUsages.fill[0]} !important;
      `,
			tip: css`
				color: ${isDarkMode
					? token.magicColorScales.grey[4]
					: token.magicColorUsages.text[3]};
				font-size: 13px;
				font-weight: 400;
				line-height: 18px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			`,
			buttonGroups: css`
				.${prefixCls}-btn {
					padding-left: 6px;
					padding-right: 6px;
					font-size: 12px;
					font-weight: 400;
					line-height: 16px;

					.${prefixCls}-btn-icon {
						margin-inline-end: 2px !important;
					}
				}
			`,
			extra: css`
				border-top: 1px solid ${token.colorBorder};
				background: ${token.magicColorUsages.fill[0]};
			`,
			referMessageSection: css`
				background: ${token.magicColorUsages.fill[0]};
				padding: 8px 12px;
				width: 100%;
			`,
			referMessage: css`
				opacity: 0.8;
				color: ${token.magicColorUsages.text[2]};
				font-size: 12px;
				font-weight: 400;
			`,
		}
	},
)

export default function useInputStyles({ disabled }: { disabled?: boolean }) {
	const { styles: modernStyles } = useModernStyles({
		disabled,
	})

	const { styles: standardStyles } = useStandardStyles({
		disabled,
	})

	return {
		modernStyles,
		standardStyles,
	}
}
