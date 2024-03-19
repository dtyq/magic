import { createStyles } from "antd-style"

const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 1000;
			pointer-events: none;
		`,

		modal: css`
			width: 360px;
			height: calc(100% - 44px - 20px);
			position: absolute;
			bottom: 10px;
			right: 10px;
			display: flex;
			flex-direction: column;
			background: ${token.magicColorUsages.bg[0]};
			border-radius: 8px;
			box-shadow: 0px 4px 24px 0px rgba(0, 0, 0, 0.12);
			overflow: hidden;
			pointer-events: auto;
			transform: translateX(0);
			transition: transform 0.3s ease-out;
		`,

		modalHidden: css`
			transform: translateX(120%);
			pointer-events: none;
		`,

		header: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			padding: "20px",
		},

		headerLeft: {
			display: "flex",
			alignItems: "center",
			gap: 8,
		},

		headerLeftIcon: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: 30,
			height: 30,
			borderRadius: 8,
			color: "#fff",
			background: "linear-gradient(90deg, #FF5F6D 0%, #FFC371 100%)",
		},

		title: {
			fontSize: 18,
			lineHeight: "24px",
			fontWeight: 600,
			color: token.magicColorUsages.text[1],
		},

		headerRight: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: 30,
			height: 30,
			borderRadius: 6,
			cursor: "pointer",

			"&:hover": {
				backgroundColor: "#f9f9f9",
			},
		},

		content: {
			flex: 1,
			padding: "10px 20px",
			overflowY: "auto",
		},

		shortcutGroup: {
			marginBottom: 10,

			"&:last-child": {
				marginBottom: 0,
			},
		},

		groupTitle: {
			padding: "10px 0",
			fontSize: 14,
			fontWeight: 600,
			color: token.magicColorUsages.text[0],
		},

		groupSubTitle: {
			padding: "10px 0",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			fontSize: 12,
			color: token.magicColorUsages.text[1],
			borderBottom: `1px solid ${token.magicColorUsages.border}`,
		},

		shortcutItem: {
			padding: "10px 0",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			gap: 10,
			borderBottom: `1px solid ${token.magicColorUsages.border}`,
		},

		shortcutOperation: {
			fontSize: 12,
			fontWeight: 600,
			color: token.magicColorUsages.text[1],
			flex: 1,
		},

		shortcutKeys: {
			width: 155,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			gap: 4,
			fontFamily: "Inter",
		},

		shortcutKey: {
			minWidth: 20,
			height: 20,
			padding: 3,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			fontSize: 12,
			color: token.magicColorUsages.text[2],
			background: token.magicColorUsages.bg[2],
			border: `1px solid ${token.magicColorUsages.border}`,
			borderRadius: 4,
		},
	}
})

export default useStyles
