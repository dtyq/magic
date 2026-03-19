import { createStyles } from "antd-style"

import bg from "@/assets/resources/bg2.jpg"
import bgDark1 from "@/assets/resources/bg1-dark.jpg"

const useStyles = createStyles(({ css, token, isDarkMode }, { open }: { open: boolean }) => {
	return {
		container: css`
			width: ${open ? "340px" : 0};
			padding: ${open ? "20px" : 0};
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[0]
				: token.magicColorUsages.white};
			border-left: 1px solid ${token.colorBorder};
			background-image: ${isDarkMode ? `url(${bgDark1})` : `url(${bg})`};
			background-size: contain;
			background-repeat: no-repeat;
			position: relative;
			overflow: hidden;
			transition: width 0.2s;
			flex-shrink: 0;
			height: calc(100vh - ${token.titleBarHeight}px);
			position: sticky;
			top: 0;
		`,
		close: css`
			position: absolute;
			top: 20px;
			right: 20px;
			cursor: pointer;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
		`,
		top: css`
			margin-top: 50px;
			width: 100%;
		`,
		flag: {
			display: "flex",
			height: 20,
			padding: "2px 8px",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			border: "none",
			borderRadius: 3,
			background: isDarkMode ? token.magicColorScales.grey[5] : "rgba(240, 177, 20, 0.15)",
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorScales.amber[8],
			fontSize: 12,
			fontWeight: 400,
			lineHeight: "16px",
		},
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			text-align: center;

			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
		`,
		description: css`
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
			text-align: center;

			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
		`,
		nums: css`
			margin-top: 12px;
			width: 100%;
			padding: 10px 0;
			border-top: 1px solid
				${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
		`,
		numLabel: css`
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[2]};
			text-align: center;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,
		num: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			text-align: center;
			font-family: D-DIN-PRO;
			font-size: 32px;
			font-weight: 500;
		`,
		buttons: css`
			width: 100%;
		`,
		button: css`
			height: 42px;
			padding: 6px 12px;
			border-radius: 8px;
		`,
		plainButton: css`
			border: 1px solid ${token.colorBorder};
			background-color: ${token.colorBgContainer};
		`,
		disabledButton: css`
			border: 1px solid ${token.colorBorder};
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		magicColor: css`
			background: linear-gradient(117deg, #ea08d3 -53.65%, #315cec 163.03%);
			border: none;
			color: ${token.magicColorUsages.white};

			&:hover {
				background: linear-gradient(117deg, #ff0ffa -53.65%, #315cec 163.03%) !important;
				color: ${token.magicColorUsages.white} !important;
			}
		`,
		defaultAvatar: {
			borderRadius: 8,
			width: 50,
			height: 50,
		},
	}
})

export default useStyles
