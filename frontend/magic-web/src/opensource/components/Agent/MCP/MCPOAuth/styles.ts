import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		layout: css`
			width: 100%;
			border-radius: 12px;
			overflow: hidden;
		`,
		header: css`
			width: 100%;
			height: 80px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 20px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 18px;
			font-style: normal;
			font-weight: 600;
			line-height: 24px; /* 133.333% */
		`,
		icon: css`
			width: 40px;
			height: 40px;
			flex: none;
			border-radius: 8px;
			overflow: hidden;
		`,
		title: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 1;
			align-self: stretch;
			overflow: hidden;
		`,
		desc: css`
			overflow: hidden;
			color: ${token.magicColorUsages.text[2]};
			text-overflow: ellipsis;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 1;
			align-self: stretch;
		`,
		close: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all linear 0.1s;
			border-radius: 6px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		body: css`
			padding: 0 0 20px 0;

			& .simplebar-content {
				padding: 0 20px !important;
			}
		`,
		wrapper: css`
			width: 100%;
			height: auto;
			max-height: 60vh;
			border-radius: 6px;
		`,
		loading: css`
			width: 100%;
			min-height: 80px;
		`,
		menu: css`
			width: 100%;
			padding: 0 20px;
		`,
		item: css`
			margin-bottom: 10px;
		`,
		section: css`
			display: flex;
			padding: 6px 24px;
			justify-content: center;
			align-items: center;
			align-self: stretch;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-style: normal;
			cursor: pointer;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
		`,
		active: css`
			background-color: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.hover};
			}

			&:active {
				background-color: ${token.magicColorUsages.primaryLight.active};
			}
		`,
	}
})
