import { createStyles } from "antd-style"

export const useOrganizationSwitchPanelStyles = createStyles(({ token, css }) => {
	return {
		panelContainer: css`
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			height: 80vh;
			// Set higher z-index to appear above GlobalSidebar
			--adm-popup-z-index: 1020;
			overflow: hidden;
		`,

		title: css`
			display: flex;
			padding: 10px 16px;
			align-items: center;
			gap: 10px;
			align-self: stretch;
			color: ${token.magicColorUsages?.text?.[1]};
			font-size: 16px;
			border-bottom: 1px solid ${token.magicColorUsages?.border};
			font-weight: 600;
			line-height: 22px;
		`,

		footer: css`
			padding: 10px 16px;
			background-color: ${token.colorBgContainer};
			display: flex;
			justify-content: center;
			align-items: center;
			align-self: stretch;
			border-top: 1px solid ${token.magicColorUsages?.border};
		`,
	}
})
