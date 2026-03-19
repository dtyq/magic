import { createStyles } from "antd-style"
import { opacify } from "polished"

const emptyHeightMap = {
	default: "20px",
	small: "20px",
	mobile: "20px",
}

const emptyPaddingMap = {
	default: "8px",
	small: "4px",
	mobile: "4px",
}

const lineHeightMap = {
	default: "20px",
	small: "20px",
	mobile: "20px",
}

const fontSizeMap = {
	default: "14px",
	small: "12px",
	mobile: "12px",
}

// Super Placeholder 组件样式
export const useStyles = createStyles(
	({ token, css }, { size = "default" }: { size?: "default" | "small" | "mobile" }) => ({
		wrapper: css`
			display: inline;

			.super-placeholder {
				/* Default inline behavior for text flow */
				display: inline;

				background: ${token.magicColorUsages.primaryLight.default};
				border-radius: 4px;
				font-size: ${fontSizeMap[size]};
				font-family: inherit;
				color: ${token.magicColorUsages.primary.default};
				outline: none;
				padding: 3px ${emptyPaddingMap[size]};
				box-sizing: border-box;
				min-width: 3ch;
				width: auto;
				white-space: normal;
				line-height: ${lineHeightMap[size]};
				cursor: text;
				margin: 0 3px;
				vertical-align: initial;
				word-break: break-word;
				overflow-wrap: break-word;

				/* Allow natural text flow wrapping */
				max-width: none;

				/* When empty, use inline-block to maintain width stability */
				&:empty {
					display: inline-block;
					height: ${emptyHeightMap[size]};
					padding: 0 ${emptyPaddingMap[size]};
				}

				/* Show placeholder when empty */
				&:empty::before {
					content: attr(data-placeholder);
					color: ${opacify(0.5)(token.magicColorUsages.primaryLight.active)};
					pointer-events: none;
				}

				&::selection {
					background-color: ${token.magicColorUsages.primaryLight.hover};
					color: ${token.colorText};
				}

				&::-moz-selection {
					background-color: ${token.magicColorUsages.primaryLight.hover};
					color: ${token.colorText};
				}

				/* Focus styles - simple background change without overlays */
				&:focus {
					outline: none;
				}

				/* Ensure contentEditable cursor is visible */
				&[contenteditable="true"] {
					-webkit-user-select: text;
					-moz-user-select: text;
					-ms-user-select: text;
					user-select: text;
				}

				&[contenteditable="true"]:focus {
					caret-color: ${token.magicColorUsages.primary.default};
				}
			}
		`,
	}),
)
