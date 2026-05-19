import { createStyles } from "antd-style"
import { MagicMermaidType } from "./constants"

export const useStyles = createStyles(
	({ css, token, isDarkMode }, { type }: { type: MagicMermaidType }) => ({
		container: css`
			position: relative;
			display: flex;
			justify-content: center;
			align-items: center;
			margin: 10px 0;
			min-height: 55px;
			background-color: ${token.colorBgContainer};
			overflow: hidden;

			.mode-switch {
				opacity: 0;
				transition: opacity 0.2s ease;
			}

			&:hover {
				.mode-switch {
					opacity: 1;
				}
			}
		`,
		error: css`
			display: ${type === MagicMermaidType.Mermaid ? "block" : "none"};
			padding: 10px;
			margin-right: 140px;
		`,
		segmented: css`
			bottom: 10px;
			right: 10px;
			position: absolute;
			z-index: 1;
		`,
		mermaid: css`
			display: ${type === MagicMermaidType.Mermaid ? "block" : "none"};
			width: 100%;
			font-size: 14px;
			line-height: 1;
		`,
		mermaidInnerWrapper: css`
			border: none;
			padding: 20px 10px;
			cursor: pointer;
			line-height: 1;
			height: fit-content;

			svg text {
				fill: ${isDarkMode ? `${token.colorText} !important` : "unset"};
			}
		`,
		previewCanvas: css`
			width: 100%;
			height: 100%;
			flex: 1;
			min-height: 0;
			overflow: hidden;
			background: ${token.colorBgLayout};
		`,
		previewRoot: css`
			width: 100%;
			height: 100%;
		`,
		previewSvg: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;

			svg {
				display: block;
				max-width: 100%;
				max-height: 100%;
				width: auto;
				height: auto;
			}
		`,
		code: css`
			display: ${type === MagicMermaidType.Mermaid ? "none" : "block"};
			width: 100%;
			border: none;
			margin: 0;
		`,
	}),
)
