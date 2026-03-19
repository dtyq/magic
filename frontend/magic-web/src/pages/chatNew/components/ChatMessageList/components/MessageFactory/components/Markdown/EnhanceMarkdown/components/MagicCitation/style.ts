import { createStyles } from "antd-style"

import { calculateRelativeSize } from "@/utils/styles"

export const useStyles = createStyles(
	({ css, isDarkMode, token, prefixCls }, { fontSize }: { fontSize: number }) => {
		return {
			container: css`
				max-width: 80%;
				width: fit-content;
				border-radius: 12px;
				background: ${isDarkMode ? token.colorBgContainer : token.magicColorUsages.white};
			`,
			summary: css`
				width: 100%;
				overflow: visible;
				white-space: pre-wrap;
				word-break: break-all;
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[1]};
				text-align: justify;
				font-size: ${fontSize}px;
				font-weight: 400;
				line-height: ${calculateRelativeSize(20, fontSize)}px;
			`,
			collapse: css`
				.${prefixCls}-collapse-header.${prefixCls}-collapse-header {
					border-top: 1px solid
						${isDarkMode
					? token.magicColorScales.grey[6]
					: token.magicColorUsages.border};
					padding-left: 0;
					padding-right: 0;
					color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[1]};
					text-align: justify;
					font-size: ${fontSize}px;
					font-weight: 600;
					line-height: ${calculateRelativeSize(20, fontSize)}px;
				}
				.${prefixCls}-collapse-content-box.${prefixCls}-collapse-content-box {
					padding: 0;
					padding-block: 0 !important;
				}
			`,
			sourceDot: css`
				position: relative;
				top: -${calculateRelativeSize(3, fontSize)}px;
				display: inline-flex;
				width: fit-content;
				min-width: ${fontSize}px;
				height: ${fontSize}px;
				margin: 0 ${calculateRelativeSize(3, fontSize)}px;
				padding: 0 ${calculateRelativeSize(3, fontSize)}px;
				justify-content: center;
				align-items: center;
				border-radius: 100px;
				user-select: none;

				color: ${isDarkMode
					? token.magicColorUsages.text[0]
					: token.magicColorUsages.text[1]};
				font-weight: 500;
				text-align: justify;

				--main-color: ${isDarkMode
					? token.magicColorUsages.primaryLight.active
					: token.magicColorUsages.fill[2]};

				background-color: var(--main-color);
				cursor: pointer;
				font-size: ${calculateRelativeSize(8, fontSize)}px;

				// &::before {
				// 	width: 100%;
				// 	height: 100%;
				// 	content: "";
				// 	position: absolute;
				// 	top: 50%;
				// 	left: 50%;
				// 	transform: translate(-50%, -50%);
				// 	border: 2px solid var(--main-color);
				// 	border-radius: 100px;
				// 	animation: diffusion 2s linear infinite;

				// 	@keyframes diffusion {
				// 		0% {
				// 			width: 100%;
				// 			height: 100%;
				// 			opacity: 1;
				// 			filter: blur(0);
				// 		}
				// 		100% {
				// 			width: 200%;
				// 			height: 200%;
				// 			opacity: 0;
				// 			filter: blur(4px);
				// 		}
				// 	}
				// }
			`,
			relatedPopover: css`
				max-width: 300px;

				.${prefixCls}-popover-title {
					--${prefixCls}-popover-title-margin-bottom: 10px;

					color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[0]};
					font-family: "PingFang SC";
					font-size: 16px;
					font-weight: 600;
					line-height: 22px;
				}

        .magic-popover-inner-content {
					color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[0]};
					font-size: 14px;
					line-height: 20px;
				}
			`,
			relatedList: css`
				width: 100%;
				overflow-x: auto;
				padding-bottom: 5px;
				margin-bottom: 5px;
			`,
			sourceList: css`
				padding-left: 2em;
				margin: 0;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				font-style: normal;
				font-weight: 400;
				line-height: ${calculateRelativeSize(16 * 1.2, fontSize)}px;
			`,
			sourceName: css`
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[1]};
			`,
			sourceButton: css`
				justify-content: flex-start !important;
			`,
		}
	},
)
