import { calculateRelativeSize } from "@/utils/styles"
import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token, isDarkMode }, { fontSize }: { fontSize: number }) => {
		return {
			container: css`
				cursor: pointer;
				display: flex;
				width: 100%;
				max-width: 340px;
				min-width: 100px;
				flex-direction: column;
				justify-content: center;
				align-items: flex-start;
				overflow: hidden;
				border-radius: 12px;
				border: 1px solid ${token.colorBorder};
				background: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorScales.white};
				user-select: none;
			`,
			image: css`
				border: 1px solid ${token.magicColorUsages.border};
				border-radius: 6px;
				overflow: hidden;
				width: fit-content;
				user-select: none;
				max-width: 200px;
			`,
			top: css`
				padding: 10px 14px;
				width: 100%;
				min-width: 0;
			`,
			name: css`
				color: ${token.magicColorUsages.text[1]};
				text-align: justify;
				font-weight: 400;
				font-size: ${fontSize}px;
				line-height: ${calculateRelativeSize(20, fontSize)}px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				min-width: 0;
				max-width: 100%;
				word-break: break-all;
			`,
			size: css`
				color: ${token.magicColorUsages.text[3]};
				font-weight: 400;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				line-height: ${calculateRelativeSize(16, fontSize)}px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`,
			footer: css`
				width: 100%;
				border-top: 1px solid ${token.magicColorUsages.border};
				background: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorScales.white};

				> button:not(:last-child) {
					border-right: 1px solid ${token.magicColorUsages.border};
				}
			`,
			button: css`
				border-radius: 0;
				color: ${token.magicColorUsages.text[1]};
				text-align: justify;
				font-weight: 400;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				line-height: ${calculateRelativeSize(16, fontSize)}px;
				min-width: 0;

				> span {
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					min-width: 0;
				}
			`,
		}
	},
)
