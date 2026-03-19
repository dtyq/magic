import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		githubMarkdown: css`
			width: 100%;
			line-height: 1.6;
			word-wrap: break-word;
			font-size: 14px;

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
				font-size: 14px;
				line-height: 1.45;
				background-color: ${isDarkMode ? "#0d1117" : "#f6f8fa"};
				border-radius: 6px;
			}

			code {
				padding: 0.2em 0.4em;
				margin: 0;
				font-size: 14px;
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
		textContent: {
			borderRadius: "8px",
			wordBreak: "break-word",
			alignItems: "center",
			"& p": {
				marginBottom: 0,
			},
		},
	}
})
