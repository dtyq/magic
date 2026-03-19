import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		list: css`
			width: 100%;
			height: 100%;
			overflow-y: auto;
			overflow-x: hidden;
			::-webkit-scrollbar {
				display: none;
			}
		`,
		empty: css`
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		scrollWrapper: css`
			overflow-y: auto !important;
			overflow-x: hidden !important;
			::-webkit-scrollbar {
				display: none;
			}
			overflow-anchor: auto;
		`,
		listItem: css`
			margin-block-end: 10px !important;
		`,
		desc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			padding: 10px 0;
		`,
	}
})
