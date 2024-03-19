import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		header: css`
			width: 100%;
			padding: 10px 16px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		back: css`
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		title: css`
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
		`,
		headerCount: css`
			padding: 4px 10px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 600;
			color: ${token.magicColorUsages.primary.default};
			background-color: ${token.magicColorUsages.primaryLight.default};
			border-radius: 8px;
		`,
		close: css`
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		wrapper: css`
			width: 100%;
			height: 100%;
			flex-basis: auto;
			padding: 0 20px 20px 20px;
			overflow: hidden;
			display: flex;
			flex-direction: column;
			gap: 10px;

			@media (max-width: 768px) {
				padding: 10px 0 10px 10px;
			}
		`,
		menu: css`
			width: 100%;
			height: 32px;
			flex: none;
			display: flex;
			align-items: center;
			gap: 10px;
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		tip: css`
			display: flex;
			padding: 6px 10px 6px 10px;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
		`,
		body: css`
			width: 100%;
			flex: auto;
			overflow: hidden;
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
			align-self: stretch;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorScales.grey[0]};

			@media (max-width: 768px) {
				border-radius: 0;
				border: none;
				background-color: transparent;
			}
		`,
		scroll: css`
			width: 100%;
			height: 100%;

			& .simplebar-content {
				padding: 10px !important;

				@media (max-width: 768px) {
					padding: 0 10px 0 0 !important;
				}
			}
		`,
		item: css`
			width: 100%;
			display: flex;
			padding: 10px 10px 16px 10px;
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
			align-self: stretch;
			border-radius: 8px;
			overflow: hidden;
			background-color: ${token.magicColorUsages.white};
			margin-bottom: 10px;

			&:last-child {
				margin-bottom: 0;
			}

			@media (max-width: 768px) {
				background-color: ${token.magicColorScales.grey[0]};
			}
		`,
		itemHeader: css`
			width: 100%;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		itemLabel: css`
			padding: 6px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
		`,
		itemMenu: css`
			display: flex;
			align-items: center;
			gap: 10px;

			@media (max-width: 768px) {
				width: 100%;
				justify-content: flex-end;
			}
		`,
		button: css`
			display: flex;
			padding: 4px 12px;
			justify-content: center;
			align-items: center;
			gap: 4px;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			transition: all linear 0.1s;
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		buttonFail: css`
			&:hover {
				background-color: ${token.magicColorUsages.dangerLight.default};
			}
			&:active {
				background-color: ${token.magicColorUsages.dangerLight.hover};
			}
		`,
		buttonSuccess: css`
			&:hover {
				background-color: ${token.magicColorUsages.successLight.default};
			}

			&:active {
				background-color: ${token.magicColorUsages.successLight.hover};
			}
		`,
		tag: css`
			display: flex;
			padding: 4px 6px;
			justify-content: center;
			align-items: center;
			gap: 10px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.dangerLight.default};
			color: ${token.magicColorUsages.danger.default};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			text-decoration-line: line-through;
		`,
		itemFooter: css`
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
		`,
		memoryType: css`
			padding: 2px 4px;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 4px;
		`,
		globalMemoryType: css`
			color: ${token.magicColorUsages.text[1]};
		`,
		memoryProjectName: css`
			display: flex;
			align-items: center;
			gap: 4px;
			color: ${token.magicColorUsages.text[1]};
			cursor: pointer;

			&:hover {
				font-weight: 600;
			}
		`,
		empty: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})
