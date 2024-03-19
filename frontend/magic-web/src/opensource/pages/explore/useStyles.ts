import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			width: 100%;
			height: 100%;
			minwidth: 480px;
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: none;
			::-webkit-scrollbar {
				display: none;
			}
			background: ${isDarkMode ? token.magicColorUsages.black : token.magicColorUsages.white};
		`,
		inner: {
			minWidth: 588,
			margin: "0 auto",
			padding: "0 40px",
		},
		header: {
			padding: "20px 0",
		},
		title: {
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1],
			fontSize: 26,
			fontWeight: 400,
			flexShrink: 0,
		},
		titleIcon: {
			display: "flex",
			padding: 10,
			justifyContent: "center",
			alignItems: "center",
			gap: 10,
			borderRadius: 20,
			width: "fit-content",
			height: "fit-content",
			background: isDarkMode
				? "linear-gradient(142deg, #FFF73F 0%, #F00 112.27%)"
				: "linear-gradient(95.14deg, #33D6C0 0%, #5083FB 25%, #336DF4 50%, #4752E6 75%, #8D55ED 100%)",
		},

		colorful: {
			background: isDarkMode
				? "linear-gradient(142deg, #FFF73F 0%, #F00 112.27%)"
				: "linear-gradient(95.14deg, #33D6C0 0%, #5083FB 25%, #336DF4 50%, #4752E6 75%, #8D55ED 100%)",
			backgroundClip: "text",
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			fontWeight: 700,
			transform: "skew(341deg, 0deg)",
			lineHeight: "34px",
		},
		button: css`
			height: 34px;
			padding: 6px 12px;
			background-color: ${token.colorBgContainer};
			border: 1px solid ${token.colorBorder};
			border-radius: 20px;
		`,
		magicColor: css`
			background: linear-gradient(
				95.14deg,
				#33d6c0 0%,
				#5083fb 25%,
				#336df4 50%,
				#4752e6 75%,
				#8d55ed 100%
			);
			border: none;
			color: ${token.magicColorUsages.white};

			&:hover {
				background: linear-gradient(117deg, #ff0ffa -53.65%, #315cec 163.03%) !important;
				color: ${token.magicColorUsages.white} !important;
			}
		`,
		sections: css`
			width: 100%;
			position: relative;
			border-radius: 8px;
			padding-bottom: 100px;
		`,
	}
})

export default useStyles
