import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		body: css`
			--${prefixCls}-modal-body-padding: 0;
		`,
		content: css`
			height: max-content;
			max-height: 400px;
			overflow-y: auto;
			display: grid;
			grid-template-columns: repeat(8, 1fr);
			gap: 24px;
			justify-items: center;
			align-items: center;
			padding: 20px;
		`,
		iconItem: css`
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
		`,
		selectedIcon: css`
			color: ${token.magicColorUsages.primary.default};
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 4px;
		`,
	}
})
