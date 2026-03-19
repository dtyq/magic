import { colorScales, colorUsages } from "@/providers/ThemeProvider/colors"
import { calculateRelativeSize } from "@/utils/styles"
import { createStyles } from "antd-style"
import { transparentize } from "polished"

const useStyles = createStyles(
	({ css, isDarkMode, prefixCls, token }, { fontSize }: { fontSize: number }) => {
		return {
			container: css`
				border-radius: 8px;
				border: 1px solid ${colorUsages.border};
				background: ${isDarkMode ? token.colorBgContainer : token.magicColorUsages.white};
				min-width: 33.3%;
				width: 100%;
			`,
			header: css`
				width: 100%;
				padding: 10px 10px 0 10px;
			`,
			headerIcon: css`
				border-radius: 4px;
				background: linear-gradient(
					121deg,
					#33d6c0 -11.13%,
					#5083fb 14.12%,
					#336df4 39.36%,
					#4752e6 64.61%,
					#8d55ed 89.85%
				);
				width: 20px;
				height: 20px;
				padding: 3px;
			`,
			durationTips: css``,
			duration: css`
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				color: ${isDarkMode ? colorScales.grey[4] : colorUsages.text[1]};
			`,
			title: css`
				color: ${isDarkMode ? colorScales.grey[4] : colorUsages.text[1]};
				text-align: center;
				font-size: ${calculateRelativeSize(14, fontSize)}px;
				font-weight: 600;
				line-height: ${calculateRelativeSize(20, fontSize)}px;
			`,
			body: css`
				padding: 0 10px 10px 10px;
				min-height: 100px;
			`,
			footerBtn: css`
				height: 32px;
				border: 1px solid ${colorUsages.border};
				border-radius: 8px;
				color: ${colorUsages.danger.default};
				&:hover {
					background: ${isDarkMode ? colorScales.grey[5] : colorScales.grey[0]};
				}
				cursor: pointer;
				padding: 0 10px;
				margin: 0 10px 10px 10px;
			`,
			disabled: css`
				color: ${isDarkMode ? colorScales.grey[3] : colorUsages.text[3]};
				cursor: not-allowed;
			`,
			aiResultCard: css`
				margin-top: 10px;
				width: 100%;
				background-color: ${isDarkMode
					? colorScales.grey[7]
					: transparentize(0.95, colorScales.grey[8])};
				padding: 10px;
				border-radius: 12px;
			`,
			aiResultCardTitle: css`
				font-size: 16px;
				font-weight: 600;
				line-height: 22px;
				text-align: left;
			`,
			aiResultCardContent: css`
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
				text-align: left;
				margin-top: 12px;
			`,
			aiResultTime: css`
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
				margin-top: 4px;
			`,
			collapse: css`
            --${prefixCls}-collapse-content-padding: 0px !important;
                --${prefixCls}-collapse-header-padding: 8px !important;

                .${prefixCls}-collapse-header {
                border-top: 1px solid ${token.colorBorder};
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
        `,
			originContentList: css`
				padding: 0 10px;
			`,
			originContentSpeaker: css`
				color: ${isDarkMode ? colorScales.grey[4] : colorUsages.text[2]};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
			`,
			originContentDuration: css`
				color: ${isDarkMode ? colorScales.grey[4] : colorUsages.text[2]};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
			`,
			originContentText: css`
				line-height: 20px;
			`,
			audioPlayer: css`
				display: flex;
				align-items: center;
				gap: 10px;
			`,
			playIcon: css`
				cursor: pointer;
				&:hover {
					opacity: 0.8;
				}
				cursor: pointer;
			`,
			translateText: css`
				align-self: flex-start;
				justify-self: flex-start;
				margin: 10px 0;
			`,
			doingText: css`
				justify-self: flex-end;
			`,
		}
	},
)

export default useStyles
