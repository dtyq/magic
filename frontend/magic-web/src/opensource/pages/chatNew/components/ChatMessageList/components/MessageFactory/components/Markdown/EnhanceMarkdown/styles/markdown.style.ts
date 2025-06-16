import { calculateRelativeSize } from "@/utils/styles"
import { createStyles } from "antd-style"
import { rgba } from "polished"

export const useStyles = createStyles(
	(
		{ token, isDarkMode, css, prefixCls, cx },
		{
			fontSize = 16,
			headerMultiple = 1,
			marginMultiple = 1.5,
			hiddenDetail,
		}: // isSelf = false,
		{
			fontSize?: number
			headerMultiple?: number
			marginMultiple?: number
			isSelf?: boolean
			hiddenDetail?: boolean
		},
	) => {
		const textColor = isDarkMode
			? token.magicColorScales.grey[8]
			: token.magicColorUsages.text[1]

		const markdownColor = hiddenDetail ? token.colorTextQuaternary : textColor

		const root = cx(css`
				--${prefixCls}-markdown-font-size: ${fontSize}px;
				--${prefixCls}-markdown-header-multiple: ${headerMultiple};
				--${prefixCls}-markdown-margin-multiple: ${marginMultiple};
				--${prefixCls}-markdown-border-radius: ${token.borderRadiusLG};
				--${prefixCls}-markdown-border-color: ${
			isDarkMode ? token.colorBorderSecondary : rgba(token.colorBorderSecondary, 0.5)
		};

				--${prefixCls}-markdown-color: ${markdownColor};

				position: relative;
        		overflow: hidden;
				padding-inline: 1px;
        		color: var(--${prefixCls}-markdown-color);

				font-size: var(--${prefixCls}-markdown-font-size);
				line-height: 1.5;
				word-break: break-word;
				height: max-content;
				width: 100%;
				user-select: text;
			`)

		return {
			root,
			a: css`
				a {
					color: ${isDarkMode
						? token.magicColorScales.brand[6]
						: token.magicColorUsages.link.default};

					&:hover {
						color: ${isDarkMode
							? token.magicColorScales.brand[5]
							: token.magicColorUsages.link.hover};
					}
				}
			`,
			blockquote: css`
				blockquote {
					white-space: normal;
					margin-block: 1em;
					margin-inline: 0;
					padding: ${calculateRelativeSize(8, fontSize)}px
						${calculateRelativeSize(14, fontSize)}px;
					border-radius: 4px;
					border-left: 3px solid ${token.magicColorScales.grey[3]};
					background: ${isDarkMode
						? token.magicColorScales.grey[9]
						: token.magicColorScales.grey[0]};

					> p {
						margin-block-start: 0.5em;
						margin-block-end: 0.5em;
					}
				}
			`,
			code: css`
				pre {
					margin-bottom: 10px;
					line-height: 1.2;
				}

				code:not(:has(span)) {
					display: inline-block;

					margin-inline: 0.25em;
					padding-block: 0.1em;
					padding-inline: 0.4em;

					font-family: ${token.fontFamilyCode};
					font-size: 0.875em;
					line-height: 1.25;
					word-break: break-word;
					white-space: break-spaces;

					color: var(--${prefixCls}-markdown-color);
					border: 1px solid var(--${prefixCls}-markdown-border-color);
					border-radius: 0.25em;
				}
			`,
			details: css`
				details {
					padding-block: 0.75em;
					padding-inline: 1em;
					margin-block: 1em;

					background: ${token.colorFillTertiary};
					border-radius: calc(var(--${prefixCls}-markdown-border-radius) * 1px);
					box-shadow: 0 0 0 1px var(--${prefixCls}-markdown-border-color);
					line-height: 0;

					summary {
						cursor: pointer;
						display: flex;
						align-items: center;
						list-style: none;
						position: relative;
						line-height: 1;

						&::before {
							content: "";

							position: absolute;
							inset-inline-end: 1.25em;
							transform: rotateZ(-45deg);
							right: 4px;

							display: block;

							width: 0.4em;
							height: 0.4em;

							font-family: ${token.fontFamily};

							border-block-end: 1.5px solid ${token.colorTextSecondary};
							border-inline-end: 1.5px solid ${token.colorTextSecondary};

							transition: transform 200ms ${token.motionEaseOut};
						}
					}

					&[open] {
						> summary {
							padding-block-end: 0.75em;
							margin-bottom: 10px;
							border-block-end: 1px dashed ${token.colorBorder};

							&::before {
								transform: rotateZ(45deg);
							}
						}
					}
				}
			`,
			header: css`
				h1,
				h2,
				h3,
				h4,
				h5,
				h6 {
					font-weight: 400;
					color: inherit;
					line-height: 1.2;
					margin-block: 0.5em;

					&:first-child {
						margin-block-start: 0;
					}
				}
				h1 {
					font-size: ${calculateRelativeSize(20, fontSize)}px;
				}

				h2 {
					font-size: ${calculateRelativeSize(18, fontSize)}px;
				}

				h3 {
					font-size: ${calculateRelativeSize(16, fontSize)}px;
				}

				h4 {
					font-size: ${calculateRelativeSize(14, fontSize)}px;
				}

				h5 {
					font-size: ${calculateRelativeSize(14, fontSize)}px;
				}

				h6 {
					font-size: ${calculateRelativeSize(14, fontSize)}px;
				}

				${hiddenDetail
					? `
          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            font-size: ${fontSize}px;
            line-height: ${fontSize + 4}px;
            font-weight: 400;
            margin-block: 0;
          }
          `
					: ""}
			`,
			hr: css`
				hr {
					margin-block: 0.6em;
					border-color: ${token.magicColorUsages.border};
					border-width: 1px;
					border-block-start: none;
					border-inline-start: none;
					border-inline-end: none;
					${hiddenDetail ? "display: none;" : ""}
				}
			`,

			img: css`
				> img,
				> p > img {
					margin-block: calc(var(--${prefixCls}-markdown-margin-multiple) * 1em);
					border-radius: calc(var(--${prefixCls}-markdown-border-radius) * 1px);
					box-shadow: 0 0 0 1px var(--${prefixCls}-markdown-border-color);
				}
			`,
			kbd: css`
				kbd {
					cursor: default;

					display: inline-block;

					min-width: 1em;
					margin-inline: 0.25em;
					padding-block: 0.2em;
					padding-inline: 0.4em;

					font-family: ${token.fontFamily};
					font-size: 0.875em;
					font-weight: 500;
					line-height: 1;
					text-align: center;

					background: ${token.colorBgLayout};
					border: 1px solid ${token.colorBorderSecondary};
					border-radius: 0.25em;
				}
			`,
			list: css`
				/* 任务列表项不应用通用li样式 */
				li:not(.task-list-item) {
					//margin-block: calc(var(--${prefixCls}-markdown-margin-multiple) * 0.33em);
					line-height: 1.5;
				}

				/* 对于任务列表项，确保不显示黑点 */
				li.task-list-item {
					line-height: 1.5;
					list-style: none !important;

					&::before {
						display: none !important;
						content: none !important;
					}
				}

				ul,
				ol {
					// margin-block: calc(var(--${prefixCls}-markdown-margin-multiple) * 1em);
					margin-inline-start: 1em;
					padding-inline-start: 0;
					list-style-position: outside;
					margin: 0;
					line-height: 0.2;
					margin-block-end: 0;

					ul,
					ol {
						// margin-block-start: calc(
						// 	var(--${prefixCls}-markdown-margin-multiple) * 0.33em
						// );
						margin-inline-start: calc(
							var(--${prefixCls}-markdown-margin-multiple) * 1em
						);
					}

					li {
						margin-inline-start: 1em;
						white-space: normal;

						p,
						span {
							display: inline;
							margin-bottom: 0;
							margin-left: 4px;
						}
					}
				}

				ul,
				ol {
					& ol,
					& ul {
						margin-bottom: 0;

						& > li {
							margin-bottom: 0;

							&:last-child {
								margin-bottom: 0;
							}
						}
					}
				}

				ol {
					list-style: auto;
					list-style-position: inside;

					& > li {
						margin-inline-start: 0;
					}
				}

				ul:not(.task-list-container):not(.task-list-nested) {
					list-style-type: none;

					li:not(.task-list-item) {
						position: relative;

						&::before {
							content: "";
							width: 5px;
							height: 5px;
							border-radius: 50%;
							background-color: currentColor;
							display: inline-block;
							margin-inline: -1em 0.5em;
							position: absolute;
							left: 0.08em;
							top: 0.57em;
						}
					}
				}

				/* 确保任务列表容器绝对不显示黑点 */
				ul.task-list-container,
				ul.task-list-nested {
					li {
						&::before {
							display: none !important;
							content: none !important;
						}
					}
				}
			`,
			p: css`
				p {
					font-size: ${fontSize}px;
					// line-height: ${calculateRelativeSize(20, fontSize)}px;
					line-height: 1.5;
					//margin-bottom: 0;
					margin-block: 0;
					white-space: break-spaces;

					br {
						content: "";
					}

					&:last-child {
						margin-bottom: 0;
					}
				}
			`,
			pre: css`
				pre {
					margin: ${hiddenDetail ? "0" : "6px 0"};
				}

				pre,
				[data-code-type="highlighter"] {
					white-space: break-spaces;
					border: none;

					> code {
						padding: 0 !important;

						font-family: ${token.fontFamilyCode};
						font-size: 0.875em;
						line-height: 1.6;

						border: none !important;
					}
				}

				pre[lang="markdown"] {
					white-space: normal;
				}

				pre:empty {
					display: none;
				}
			`,
			strong: css`
				strong {
					font-weight: 600;
				}
			`,
			table: css`
				.table-container {
					overflow-x: auto;
					width: fit-content;
					max-width: 100%;
					margin-block: calc(var(--${prefixCls}-markdown-margin-multiple) * 0.6em);
					border-radius: calc(var(--${prefixCls}-markdown-border-radius) * 1px);
					box-shadow: 0 0 0 1px var(--${prefixCls}-markdown-border-color);
					${isDarkMode ? "" : `border: 1px solid ${token.magicColorUsages.border}`};
				}

				table {
					overflow: hidden;
					display: table;
					table-layout: auto;
					border-spacing: 0;
					border-collapse: collapse;

					box-sizing: border-box;
					width: auto;
					margin: 0;

					font-size: 14px;
					text-align: start;
					word-break: break-word;
					overflow-wrap: anywhere;

					background: ${isDarkMode
						? token.magicColorScales.grey[2]
						: token.magicColorUsages.white};
					border-radius: calc(var(--${prefixCls}-markdown-border-radius) * 1px);

					code {
						word-break: break-word;
					}

					thead {
						background: ${isDarkMode
							? token.magicColorScales.grey[1]
							: token.magicColorScales.grey[0]};
						border-bottom: 1px solid ${token.magicColorUsages.border};
						display: table-header-group;
					}

					tr {
						box-shadow: 0 1px 0 ${token.magicColorUsages.border};
						display: table-row;

						> th:not(:last-child),
						> td:not(:last-child) {
							border-right: 1px solid ${token.magicColorUsages.border};
						}
					}

					tr:not(:last-child) {
						> td {
							border-bottom: 1px solid
								${isDarkMode
									? token.magicColorScales.grey[0]
									: token.magicColorUsages.border};
						}
					}

					th,
					td {
						display: table-cell;
						line-height: 1.5;
						padding-block: 0.75em;
						padding-inline: 1em;
						text-align: start;
						vertical-align: middle;
						white-space: normal;
						word-break: break-word;
						overflow-wrap: break-word;
						max-width: 300px;
						min-width: 80px;
						position: relative;
						font-family: ${token.fontFamily}, "Segoe UI Symbol", Arial, sans-serif;

						/* 对齐样式 */
						&[style*="text-align: center"] {
							text-align: center;
						}

						&[style*="text-align: right"] {
							text-align: right;
						}

						&[style*="text-align: left"] {
							text-align: left;
						}

						/* 确保特殊符号正常显示 */
						&[style*="white-space: pre-wrap"] {
							white-space: pre-wrap;
							font-family: ${token.fontFamilyCode}, ${token.fontFamily},
								"Segoe UI Symbol", Arial, sans-serif;
						}

						/* 超长单词处理 */
						&:has(.long-text) {
							max-width: 300px;
						}

						/* 长文本处理 */
						.long-text {
							display: block;
							width: 100%;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
							max-width: 100%;
							cursor: pointer;

							&.expanded {
								white-space: normal;
								overflow: visible;
								text-overflow: clip;
							}
						}
					}

					tbody {
						display: table-row-group;
					}
				}
			`,
			video: css`
				video {
					width: 100%;
					max-width: 500px;
					max-height: 400px;
					border-radius: 8px;
				}
			`,
			math: css`
				.katex-display {
					overflow-y: hidden;
					overflow-x: auto;
					padding: 4px 10px;
				}

				/* 移除对KaTeX内部元素的强制display样式，让KaTeX自行处理布局 */
			`,
			footnotes: css`
				/* 脚注引用样式 */
				.footnote-ref {
					font-size: 0.75em;

					a {
						color: ${isDarkMode
							? token.magicColorScales.brand[6]
							: token.magicColorUsages.link.default};
						text-decoration: none;

						&:hover {
							text-decoration: underline;
						}
					}
				}

				/* 脚注定义样式 */
				.footnote {
					font-size: 0.875em;
					margin-top: 1em;
					padding-top: 0.5em;
					border-top: 1px solid ${token.colorBorder};
					color: ${token.colorTextSecondary};

					p {
						margin: 0;
					}

					.footnote-backref {
						color: ${isDarkMode
							? token.magicColorScales.brand[6]
							: token.magicColorUsages.link.default};
						text-decoration: none;
						margin-left: 0.25em;

						&:hover {
							text-decoration: underline;
						}
					}
				}
			`,
			abbreviations: css`
				/* 缩写样式 */
				abbr {
					text-decoration: underline dotted;
					cursor: help;
					border-bottom: 1px dotted ${token.colorTextSecondary};

					&:hover {
						background-color: ${isDarkMode
							? token.magicColorScales.grey[1]
							: token.magicColorScales.grey[0]};
					}
				}
			`,

			taskList: css`
				/* Task list container reset */
				.task-list-container,
				.task-list-nested,
				ul.task-list-container,
				ul.task-list-nested {
					list-style: none !important;
					list-style-type: none !important;
					margin: 0.5em 0;
					padding-left: 0;

					/* Nested task lists */
					.task-list-nested {
						margin: 0.25em 0 0 0;
						padding-left: 1.5em;
					}

					/* Reset all list item styles */
					li {
						list-style: none !important;
						list-style-type: none !important;
						position: relative;

						&::before,
						&::after {
							display: none !important;
							content: none !important;
							width: 0 !important;
							height: 0 !important;
							background: transparent !important;
							border: none !important;
							margin: 0 !important;
							padding: 0 !important;
						}
					}
				}

				/* Task list item base styles */
				.task-list-item,
				li.task-list-item {
					list-style: none !important;
					list-style-type: none !important;
					margin: 0.25em 0;
					margin-inline-start: 0 !important;
					padding: 0;
					display: flex;
					align-items: flex-start;
					line-height: 1.4;
					position: relative;

					/* Remove all pseudo-elements */
					&::before,
					&::after {
						display: none !important;
						content: none !important;
						width: 0 !important;
						height: 0 !important;
						background: transparent !important;
						border: none !important;
						margin: 0 !important;
						padding: 0 !important;
						position: static !important;
					}

					/* Task text content */
					> span,
					> :not(input):not(ul):not(.task-list-nested) {
						flex: 1;
						margin: 0;
						line-height: 1.4;
					}

					/* Nested task list within item */
					> .task-list-nested {
						width: 100%;
						margin-top: 0.25em;
						margin-bottom: 0;
						padding-left: 0;
					}
				}

				/* Checkbox styles for different nesting levels */
				.task-list-item > input[type="checkbox"] {
					margin: 0.2em 0.5em 0 0;
					flex-shrink: 0;
					cursor: default;
					appearance: none;
					-webkit-appearance: none;
					-moz-appearance: none;
					border-radius: 3px;
					position: relative;

					/* Level 1 checkboxes */
					width: 16px;
					height: 16px;
					border: 2px solid
						${isDarkMode
							? token.magicColorScales.grey[5]
							: token.magicColorScales.grey[3]};
					background: ${isDarkMode
						? token.magicColorScales.grey[1]
						: token.magicColorUsages.white};

					&:checked {
						background: ${token.magicColorUsages.brand};
						border-color: ${token.magicColorUsages.brand};

						&::after {
							content: "✓";
							position: absolute;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							color: white;
							font-size: 12px;
							font-weight: bold;
							line-height: 1;
						}
					}

					&:focus {
						outline: 2px solid ${token.magicColorUsages.brand};
						outline-offset: 2px;
					}
				}

				/* Level 2 checkboxes */
				.task-list-item .task-list-item > input[type="checkbox"] {
					width: 14px;
					height: 14px;
					border-width: 1px;

					&:checked::after {
						font-size: 10px;
					}
				}

				/* Level 3+ checkboxes */
				.task-list-item .task-list-item .task-list-item > input[type="checkbox"] {
					width: 12px;
					height: 12px;

					&:checked::after {
						font-size: 9px;
					}
				}
			`,
		}
	},
)
