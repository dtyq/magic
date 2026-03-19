import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode, prefixCls }) => ({
	textContainer: {
		fontSize: "14px",
		display: "flex",
		flexDirection: "column",
	},
	userContainer: {
		alignItems: "flex-end",
	},
	assistantContainer: {
		alignItems: "flex-start",
	},
	textHeader: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		marginBottom: "4px",
	},
	timestamp: {
		fontSize: "12px",
		color: "#999",
	},
	avatar: {
		width: "22px",
		height: "22px",
		borderRadius: "5px",
	},
	textContent: {
		borderRadius: "8px",
		wordBreak: "break-word",
		alignItems: "center",
		"& p": {
			marginBottom: 0,
		},
	},
	atItems: {
		marginBottom: "4px",
	},
	userText: {
		backgroundColor: token.magicColorScales.grey[0],
		color: token.magicColorUsages.text[1],
		border: `1px solid ${token.magicColorUsages.border}`,
		padding: "10px",
		width: "100%",
		whiteSpace: "pre-wrap",
		borderRadius: 12,
		fontSize: "14px",
		lineHeight: "1.4",
		fontWeight: 400,
		marginLeft: "auto",
		alignSelf: "flex-end",
	},
	assistantText: {
		width: "100%",
		color: token.magicColorUsages.text[1],
	},
	finishedText: {
		backgroundColor: token.magicColorUsages.successLight.default,
		color: token.magicColorUsages.success.default,
		borderRadius: "100px",
		padding: "6px 12px",
		fontSize: "12px",
		fontWeight: 400,
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		gap: "4px",
	},
	suspendedText: {
		backgroundColor: token.magicColorUsages.warningLight.default,
		color: token.magicColorUsages.warning.default,
		borderRadius: "100px",
		padding: "6px 12px",
		fontSize: "12px",
		fontWeight: 400,
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		gap: "4px",
	},
	githubMarkdown: css`
		font-family:
			-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif,
			"Apple Color Emoji", "Segoe UI Emoji";
		width: 100%;
		line-height: 1.6;
		word-wrap: break-word;
		color: "white";

		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			margin-top: 5px;
			margin-bottom: 10px;
			font-weight: 600;
			line-height: 1.25;
			color: ${isDarkMode ? token.colorTextLightSolid : token.colorTextHeading};
		}

		h1 {
			padding-bottom: 0.3em;
			font-size: 2em;
			border-bottom: 1px solid ${isDarkMode ? "#30363d" : "#eaecef"};
		}

		h2 {
			padding-bottom: 0.3em;
			font-size: 1.5em;
			border-bottom: 1px solid ${isDarkMode ? "#30363d" : "#eaecef"};
		}

		h3 {
			font-size: 1.25em;
		}

		h4 {
			font-size: 1em;
		}
		p {
			white-space: pre-wrap;
		}
		p,
		blockquote,
		ul,
		ol,
		dl,
		table,
		pre {
			margin-top: 0;
		}
		a {
			color: ${isDarkMode ? "#58a6ff" : "#0366d6"};
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

		blockquote {
			padding: 0 1em;
			color: ${isDarkMode ? "#8b949e" : "#6a737d"};
			border-left: 0.25em solid ${isDarkMode ? "#30363d" : "#dfe2e5"};
		}

		pre {
			padding: 16px;
			overflow: auto;
			font-size: 85%;
			line-height: 1.45;
			background-color: ${isDarkMode ? "#0d1117" : "#f6f8fa"};
			border-radius: 6px;
		}

		code {
			padding: 0.2em 0.4em;
			margin: 0;
			font-size: 85%;
			background-color: ${isDarkMode ? "#1f2937" : "#f6f8fa"};
			border-radius: 6px;
		}

		pre code {
			padding: 0;
			margin: 0;
			font-size: 100%;
			background-color: transparent;
			border: 0;
		}

		table {
			display: block;
			width: 100%;
			overflow: auto;
			border-spacing: 0;
			border-collapse: collapse;
		}

		table th,
		table td {
			padding: 6px 13px;
			border: 1px solid ${isDarkMode ? "#30363d" : "#dfe2e5"};
		}

		table tr {
			background-color: ${isDarkMode ? "#0d1117" : "#ffffff"};
			border-top: 1px solid ${isDarkMode ? "#30363d" : "#c6cbd1"};
		}

		table tr:nth-child(2n) {
			background-color: ${isDarkMode ? "#161b22" : "#f6f8fa"};
		}

		img {
			max-width: 100%;
			box-sizing: content-box;
			background-color: ${isDarkMode ? "#0d1117" : "#ffffff"};
		}

		ul,
		ol {
			padding-left: 2em;
			margin-top: 5px;
		}

		ul ul,
		ul ol,
		ol ol,
		ol ul {
			margin-top: 0;
			margin-bottom: 0;
		}

		li {
			word-wrap: break-word;
			white-space: pre-wrap;
		}

		li + li {
			margin-top: 0.25em;
		}

		.task-list-item {
			list-style-type: none;
			position: relative;
			padding-left: 0.5em;
		}

		.task-list-item input[type="checkbox"] {
			margin: 0 0.5em 0 -1.5em;
			vertical-align: middle;
		}

		hr {
			height: 0.25em;
			padding: 0;
			margin: 24px 0;
			background-color: ${isDarkMode ? "#30363d" : "#e1e4e8"};
			border: 0;
		}
	`,
	moreContainer: css`
		margin-top: 6px;
		display: flex;
		align-items: center;
		gap: 4px;
	`,
	undoContainer: css`
		height: 20px;
		padding: 0px 6px;
		display: flex;
		align-items: center;
		gap: 4px;
		background: ${token.magicColorUsages.bg[1]};
		border-radius: 6px;
		font-size: ${token.magicFontUsages.response.text10px};
		line-height: 13px;
		font-weight: 400;
		color: ${token.magicColorUsages.text[2]};
		border: 1px solid ${token.magicColorUsages.border};
		cursor: pointer;

		&:hover {
			color: ${token.magicColorUsages.text[2]};
			background: ${token.magicColorUsages.fill[0]};
		}
	`,
	actionIcon: css`
		color: ${token.magicColorUsages.text[1]};
	`,
	actionText: css`
		font-size: ${token.magicFontUsages.response.text12px};
		line-height: 16px;
		font-weight: 400;
	`,
	undoText: css`
		color: ${token.magicColorUsages.text[1]};
	`,
	moreButton: css`
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.magicColorUsages.text[1]};
		border-radius: 6px;
		border: 1px solid ${token.magicColorUsages.border};
		background: ${token.magicColorUsages.bg[1]};
		cursor: pointer;

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}
	`,
	moreActionsDropdown: css`
		.${prefixCls}-dropdown-menu {
			padding: 6px;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.${prefixCls}-dropdown-menu-item {
			padding: 4px 6px !important;
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.${prefixCls}-dropdown-menu-item-icon {
			margin-inline-end: 0 !important;
		}
	`,
	createScheduleTask: css`
		margin-top: 6px;
		height: 23px;
		padding: 4px 6px;
	`,
}))
