import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => {
	return {
		layout: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: stretch;
		`,
		wrapper: css`
			flex: auto;
			background: ${token.magicColorScales.grey[0]};
			overflow: hidden;
		`,
		clickable: {
			cursor: "pointer",
		},
		breadcrumb: css`
			padding: 10px;
			.${prefixCls}-breadcrumb-separator {
				display: flex;
				align-items: center;
				margin: 0 4px;
			}
		`,
		notAuthPage: css`
			width: 100%;
			height: 100%;
			background-color: transparent;
		`,
		content: css`
			height: 100%;
			overflow-y: auto;
			scrollbar-width: none;
		`,
		contentPadding: css`
			padding: 0 10px;
		`,
	}
})
