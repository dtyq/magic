import { calculateRelativeSize } from "@/utils/styles"
import { createStyles } from "antd-style"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"

interface StyleOptions {
	fontSize?: number
	isSearchingFinish?: boolean
	hasLlmResponse?: boolean
}

const useStyles = createStyles(
	({ css, prefixCls, token, isDarkMode }, { fontSize = 14 }: StyleOptions) => {
		return {
			container: css`
				background: ${isDarkMode ? token.magicColorUsages.bg[1] : token.colorBgContainer};
				border-radius: 8px;
				overflow: hidden;
				max-width: 800px;
			`,
			timelineContainer: css`
				border-radius: 8px;
				position: relative;
				transition: height 0.3s ease-in-out;

				.${prefixCls}-collapse-content-box {
					padding-block: 0 !important;
				}
			`,
			timeline: css`
			  --${prefixCls}-timeline-dot-bg: transparent !important;
        --${prefixCls}-timeline-item-padding-bottom: 14px !important;
        --${prefixCls}-control-height-lg: 20px !important;
        --${prefixCls}-timeline-tail-color: ${token.magicColorUsages.border} !important;
        margin-top: 10px;
        margin-bottom: -10px;
        padding: 0 4px;
        z-index: 10;
        max-width: 800px;
		  `,
			timelineItem: css`
				@keyframes timeline-enter {
					0% {
						opacity: 0;
					}
					100% {
						opacity: 1;
					}
				}
				animation: timeline-enter 0.3s ease-in-out;
			`,
			questionTitle: css`
				text-align: justify;
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
				color: ${token.magicColorUsages.text[2]};
			`,
			collapsedSummary: css`
				color: ${token.magicColorUsages.text[2]};
				text-align: justify;
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
				user-select: none;
			`,
			mindmap: css`
				border-radius: 12px;
				border: 1px solid ${token.colorBorder};
				margin: 14px 0;
				position: relative;
				overflow: hidden;
			`,
			mindmapTitle: css`
				padding: 8px 12px;
				color: ${token.colorTextSecondary};
				text-align: justify;
				font-size: 14px;
				font-style: normal;
				line-height: 20px;
				font-weight: 600;
			`,
			eventTable: css`
				border: 1px solid ${token.colorBorder};
				border-radius: 8px;
				overflow: hidden;

				th[class*="magic-table-cell"] {
					background: ${token.magicColorScales.grey[0]} !important;
				}

				td[class*="magic-table-cell"]:not(:last-child),
				th[class*="magic-table-cell"]:not(:last-child) {
					border-right: 1px solid ${token.colorBorder};
				}

				th[class*="magic-table-cell"] {
					color: ${token.colorTextSecondary};
					font-size: 12px;
					font-weight: 600;
					line-height: 16px;
				}

				td[class*="magic-table-cell"] {
					color: ${token.colorTextSecondary};
					font-size: 12px;
					font-weight: 400;
					line-height: 16px;
				}

				tr:last-child {
					td[class*="magic-table-cell"] {
						border-bottom: none;
					}
				}
			`,
			summary: css`
				width: 100%;
				min-width: 200px;
				overflow: visible;
				word-break: break-all;
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[1]};
				text-align: justify;
				font-size: ${fontSize}px;
				font-weight: 400;
				line-height: ${calculateRelativeSize(20, fontSize)}px;
				margin-top: 10px;

				&:empty {
					margin-top: 0;
				}
			`,
			questionCollapse: css`
				--${prefixCls}-collapse-content-padding: 10px !important;
				--${prefixCls}-collapse-header-padding: 10px !important;
        color: ${token.magicColorUsages.text[2]};
			`,
			collapse: css`
			--${prefixCls}-collapse-content-padding: 0px !important;
				--${prefixCls}-collapse-header-padding: 8px !important;

				.${prefixCls}-collapse-header {
				border-top: 1px solid ${token.colorBorder};
				--${prefixCls}-border-radius-lg: 0;
			}

			.${prefixCls}-collapse-content-box {
				padding-top: 0 !important;
			}

			.${prefixCls}-collapse-header-text {
				color: ${token.colorTextSecondary};
				text-align: justify;
				font-size: 14px;
				font-weight: 600;
				line-height: 20px;
			}

      .${prefixCls}-collapse-item:last-child {
          margin-bottom: -10px;
      }
		  `,

			labelCount: css`
				color: ${token.colorTextTertiary};
				text-align: justify;
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
			`,
			sourceList: css`
				padding-left: 2em;
				margin: 0;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				font-style: normal;
				font-weight: 400;
				line-height: ${calculateRelativeSize(16 * 1.2, fontSize)}px;
			`,
			questionReadCount: css`
				color: ${token.colorTextTertiary};
				text-align: justify;
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
			`,
			searchKeyword: css`
				background: ${token.magicColorScales.brand[0]};
				padding: 2px 8px;
				border-radius: 4px;
				color: ${token.colorTextSecondary};
				font-size: 12px;

				@keyframes keyword-enter {
					0% {
						opacity: 0;
						transform: translateY(10px);
					}
					100% {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`,
			searchSummary: css`
				color: ${token.colorTextTertiary};
				text-align: justify;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
			`,
			searchSummaryTips: css`
				color: ${token.colorTextQuaternary};
				font-size: 12px;
				font-style: normal;
				font-weight: 400;
				line-height: 16px;
			`,
		}
	},
)

export default (props?: StyleOptions) => {
	const { fontSize } = useFontSize()

	return useStyles({ fontSize, ...props })
}
