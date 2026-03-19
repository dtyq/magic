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
			flex: 1;
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
		`,
		close: css`
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		wrapper: css`
			width: 100%;
			height: 100%;
			padding: 0 20px 20px 20px;
			flex-basis: auto;
			display: flex;
			flex-direction: column;
			gap: 20px;

			@media (max-width: 768px) {
				padding: 0px;
				gap: 0px;
			}
		`,
		menu: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
			flex: none;
		`,
		menuHeader: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		menuWrapper: css`
			width: 100%;
			display: flex;
			gap: 10px;
		`,
		menuCard: css`
			display: flex;
			padding: 10px;
			align-items: center;
			gap: 10px;
			flex: 1 0 0;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorUsages.bg[0]};
			cursor: pointer;

			& span {
				color: ${token.magicColorUsages.text[1]};
				font-size: 14px;
				font-style: normal;
				font-weight: 600;
				line-height: 20px; /* 142.857% */
			}
		`,
		menuCardIcon: css`
			display: flex;
			width: 40px;
			height: 40px;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			gap: 10px;
			border-radius: 8px;
			overflow: hidden;
			background-color: ${token.magicColorUsages.primaryLight.default};
		`,
		body: css`
			flex: auto;
			display: flex;

			@media (max-width: 768px) {
				padding: 10px;
			}
		`,
		footer: css`
			display: flex;
			justify-content: flex-end;
			gap: 10px;

			@media (max-width: 768px) {
				padding: 10px 10px 30px 10px;
				justify-content: space-between;
				gap: 12px;
				border-top: 1px solid ${token.magicColorUsages.border};
			}
		`,
		cancelButton: css`
			padding: 6px 24px;
			background-color: ${token.magicColorUsages.bg[0]};
			color: ${token.magicColorUsages.text[2]};

			&:hover {
				color: ${token.magicColorUsages.text[2]} !important;
			}

			@media (max-width: 768px) {
				height: 40px;
				font-size: 14px;
				line-height: 20px;
				border-radius: 8px;
				color: ${token.magicColorUsages.text[1]};
				background-color: ${token.magicColorUsages.fill[0]};
				border: none;
			}
		`,
		editButton: css`
			padding: 6px 24px;
			background-color: ${token.magicColorUsages.bg[0]};

			@media (max-width: 768px) {
				height: 40px;
				font-size: 14px;
				line-height: 20px;
				border-radius: 8px;
				color: ${token.magicColorUsages.text[1]};
				background-color: ${token.magicColorUsages.fill[0]};
				border: none;

				&:hover {
					color: ${token.magicColorUsages.text[2]} !important;
				}
			}
		`,
		confirmButton: css`
			padding: 6px 24px;

			@media (max-width: 768px) {
				height: 40px;
				flex: 1;
				font-size: 14px;
				line-height: 20px;
				border-radius: 8px;
			}
		`,
	}
})
