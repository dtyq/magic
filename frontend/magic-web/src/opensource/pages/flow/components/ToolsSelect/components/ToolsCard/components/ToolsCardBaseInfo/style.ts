import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, token }, { img }: { img: string }) => {
	const linearBg = css`
		position: absolute;
		width: 70%;
		height: 70%;
		top: -50%;
		right: -20%;
		background-image: url(${img});

		--opacity-base: 0.3;
		animation: diffuse 10s linear infinite;

		@keyframes diffuse {
			0% {
				filter: blur(50px);
				opacity: var(--opacity-base);
			}
			50% {
				filter: blur(70px);
				opacity: calc(var(--opacity-base) * 2);
			}
			100% {
				filter: blur(50px);
				opacity: var(--opacity-base);
			}
		}
	`

	return {
		container: {
			cursor: "pointer",
			width: "100%",
			justifyContent: "space-between",
			// position: "relative",
			// overflow: "hidden",
		},
		linearBg,
		title: {
			overflow: "hidden",
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1],
			textOverflow: "ellipsis",
			fontSize: 16,
			fontWeight: 600,
			lineHeight: "22px",
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 1,
			wordBreak: "break-all",
		},
		title14: {
			fontSize: 14,
			lineHeight: "20px",
		},
		descroption: {
			width: "100%",
			flex: 1,
			overflow: "hidden",
			color: isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2],
			textOverflow: "ellipsis",
			fontSize: 12,
			fontWeight: 400,
			lineHeight: "18px",
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 1,
			wordBreak: "break-all",
		},
		lineClamp2: {
			WebkitLineClamp: 2,
		},
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
		more: {
			position: "relative",
			zIndex: 9,
		},
		creator: {
			color: token.magicColorScales.brand[5],
		},
		defaultAvatar: {
			borderRadius: 8,
			width: 50,
			height: 50,
		},
	}
})

export default useStyles
