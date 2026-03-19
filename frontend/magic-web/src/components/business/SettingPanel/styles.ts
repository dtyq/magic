import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => {
	return {
		container: css`
			display: flex;
			width: 100%;
			height: 100%;
			background: ${token.colorBgContainer};
			border-radius: 12px;
			overflow: hidden;
			box-shadow:
				0px 4px 14px 0px rgba(0, 0, 0, 0.1),
				0px 0px 1px 0px rgba(0, 0, 0, 0.3);
		`,

		sidebar: css`
			width: 200px;
			height: 100%;
			background: ${isDarkMode
				? token.magicColorScales.grey[1]
				: token.magicColorScales.grey[0]};
			border-right: 1px solid ${token.colorBorder};
			display: flex;
			flex-direction: column;
			flex-shrink: 0;
		`,

		sidebarContent: css`
			flex: 1;
			overflow-y: auto;
			padding: 14px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,

		menuGroup: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,

		groupTitle: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
			padding: 0 10px;
			margin-bottom: 4px;
		`,

		menuItem: css`
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 6px 10px;
			border-radius: 4px;
			cursor: pointer;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			line-height: 20px;
			transition: background 0.2s ease;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		activeMenuItem: css`
			background: ${token.magicColorUsages.fill[0]};
		`,

		menuIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			flex-shrink: 0;
		`,

		contentArea: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			min-width: 0;
			height: 100%;
		`,

		header: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			padding: 20px;
			border-bottom: 1px solid ${token.colorBorder};
			backdrop-filter: blur(8px);
		`,

		headerLeft: css`
			display: flex;
			align-items: center;
			gap: 8px;
			flex: 1;
			min-width: 0;
		`,

		headerIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 30px;
			height: 30px;
			border-radius: 8px;
			flex-shrink: 0;
			color: ${token.magicColorUsages.white};
		`,

		headerText: css`
			display: flex;
			flex-direction: column;
			flex: 1;
			min-width: 0;
		`,

		headerTitle: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,

		headerSubtitle: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,

		closeButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			border-radius: 4px;
			cursor: pointer;
			color: ${token.magicColorUsages.text[1]};
			transition: background 0.2s ease;
			flex-shrink: 0;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		content: css`
			flex: 1;
			overflow-y: auto;
		`,

		sidebarFooter: css`
			padding: 14px;
		`,

		sidebarFooterItem: css`
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 6px 10px;
			border-radius: 4px;
			cursor: pointer;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			line-height: 20px;
			transition: background 0.2s ease;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		sidebarFooterItemIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			flex-shrink: 0;
		`,

		sidebarFooterItemText: css`
			flex: 1;
		`,
	}
})
