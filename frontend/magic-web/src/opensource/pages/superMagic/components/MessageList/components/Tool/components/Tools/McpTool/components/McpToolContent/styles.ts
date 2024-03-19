import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	// 定义颜色值（使用fallback colors）
	const colors = {
		textPrimary: token.colorText,
		textSecondary: token.colorTextTertiary,
		bgCode: token.colorBgContainer,
		keyColor: "#ff9500",
		valueColor: "#32c436",
		border: token.colorBorder,
	}

	return {
		container: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding: 10px;
			background: ${token.colorBgContainer};
			overflow: auto;
		`,

		header: css`
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px;
			border-bottom: 1px solid ${colors.border};
		`,

		checkIcon: css`
			width: 18px;
			height: 18px;
			color: #32c436;
		`,

		toolName: css`
			color: ${colors.textPrimary};
			font-family: "PingFang SC", sans-serif;
			font-size: 14px;
			font-weight: 400;
			line-height: 1.4285714285714286;
		`,

		serverName: css`
			color: ${colors.textSecondary};
			font-family: "Inter", sans-serif;
			font-size: 10px;
			font-weight: 400;
			line-height: 1.3;
		`,

		content: css`
			display: flex;
			flex-direction: column;
			overflow: auto;
			gap: 10px;
			margin-top: 10px;
		`,

		resultSection: css`
			margin-bottom: 10px;
		`,

		section: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,

		sectionTitle: css`
			color: ${colors.textPrimary};
			font-family: "PingFang SC", sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 1.3333333333333333;
		`,

		codeBlock: css`
			border: 1px solid ${colors.border};
			border-radius: 8px;
			background: ${colors.bgCode};
			overflow: auto;
			background: ${token.magicColorScales.grey[0]};

			pre {
				margin: 0 !important;
				padding: 10px !important;
				background: transparent !important;
				border: none !important;
				font-family: "JetBrains Mono", "Roboto", monospace !important;
				font-size: 12px !important;
				line-height: 1.5 !important;
				overflow: auto !important;
			}

			code {
				background: transparent !important;
			}
		`,

		// 颜色值为组件使用
		colors,
	}
})
