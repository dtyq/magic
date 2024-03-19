import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		loading: css`
			height: 100%;
		`,
		layout: css`
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
			align-self: stretch;
			padding: 10px 0;
		`,
		container: css`
			padding: 0 12px;
			width: 100%;
		`,
		icon: css`
			width: 30px;
			height: 30px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		fallback: css`
			width: 30px;
			height: 30px;
			border-radius: 8px;
			overflow: hidden;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		title: css`
			overflow: hidden;
			color: ${token.magicColorUsages.text[1]};
			text-overflow: ellipsis;
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		desc: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		button: css`
			width: 100%;
			color: ${token.magicColorUsages.text[0]};
			border-color: #1c1d2314;
			font-weight: 400;
		`,
		wrapper: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
			margin-bottom: 10px;
		`,
		wrapperHeader: css`
			width: 100%;
			padding: 0 12px;
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
		`,
		scroll: css`
			width: 100%;
			height: 600px;

			& .simplebar-content {
				padding: 0 12px 12px 12px !important;
			}
		`,
		item: css`
			width: 100%;
			display: flex;
			padding: 12px;
			flex-direction: column;
			justify-content: center;
			align-items: flex-start;
			gap: 4px;
			align-self: stretch;
			border-radius: 12px;
			background-color: ${token.magicColorUsages.fill[0]};
			margin-bottom: 10px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
		itemHeader: css`
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 6px;
		`,
		itemTitle: css`
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 1;
			word-break: break-all;
			overflow: hidden;
		`,
		itemButton: css`
			width: 24px;
			height: 24px;
			z-index: 10;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all linear 0.1s;
			border-radius: 6px;
			color: ${token.magicColorUsages.text[0]};

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		itemTag: css`
			display: flex;
			padding: 0 4px;
			justify-content: center;
			align-items: center;
			gap: 10px;
			border-radius: 4px;
			border: 1px solid ${token.magicColorUsages.warning.default};
			color: ${token.magicColorUsages.warning.default};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			cursor: pointer;

			&:hover {
				border: 1px solid ${token.magicColorUsages.warning.hover};
				color: ${token.magicColorUsages.warning.hover};
			}

			&:active {
				border: 1px solid ${token.magicColorUsages.warning.active};
				color: ${token.magicColorUsages.warning.active};
			}
		`,
		itemDesc: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		itemFooter: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		font: css`
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 1;
			word-break: break-all;
			overflow: hidden;
		`,
	}
})
