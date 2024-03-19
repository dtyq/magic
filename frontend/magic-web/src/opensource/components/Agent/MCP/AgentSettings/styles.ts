import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		layout: css`
			display: flex;
			width: 100%;
			height: 600px;
			align-items: flex-start;
			border-radius: 12px;
			background-color: ${token.magicColorScales.white[1]};
			overflow: hidden;
		`,
		panel: css`
			height: 100%;
			flex: none;
			display: flex;
			width: 200px;
			padding: 14px;
			flex-direction: column;
			justify-content: space-between;
			align-items: flex-start;
			flex-shrink: 0;
			align-self: stretch;
			border-right: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorScales.grey[0]};
		`,
		panelGroup: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
			margin-bottom: 10px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
		panelHeader: css`
			width: 100%;
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		panelItem: css`
			width: 100%;
			display: flex;
			padding: 6px 10px;
			align-items: center;
			gap: 4px;
			align-self: stretch;
			border-radius: 4px;
			cursor: pointer;
			line-height: 20px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		active: css`
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		paneFooter: css`
			margin-top: auto;
		`,
		wrapper: css`
			flex: auto;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`,
		mobileLayout: css`
			width: 100%;
			height: 76vh;
			display: flex;
			flex-direction: column;
		`,
		mobileHeader: css`
			width: 100%;
			height: 52px;
			flex: none;
			padding: 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		mobileActive: css`
			color: ${token.magicColorUsages.primary.default};
		`,
		headerClose: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
	}
})
