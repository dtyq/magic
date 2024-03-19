import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			height: 100%;
			padding: 10px;
			background-color: transparent;
		`,
		listContainer: css`
			height: 100%;
			flex: 1;
			display: grid;
			grid-template-columns: repeat(3, minmax(280px, 1fr));
			gap: 10px;
			overflow-y: auto;
			overflow-x: hidden;
			scrollbar-width: none;
			align-content: start;
		`,
		card: css`
			min-height: 106px;
			overflow: hidden;
		`,
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		status: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			text-wrap: noWrap;
		`,
		addService: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			min-height: 106px;
			background-color: ${token.magicColorUsages.bg[0]};
			cursor: pointer;
		`,
		iconWrapper: css`
			width: 50px;
			height: 50px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
		`,
		identifier: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 4px;
			padding: 2px 4px;
			background-color: ${token.magicColorUsages.fill[0]};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		button: css`
			font-size: 12px;
		`,
		spin: css`
			height: 100%;
			overflow: hidden;
			.${prefixCls}-spin {
				--${prefixCls}-spin-content-height: 100%;
			}
		`,
		label: css`
			flex-shrink: 0;
		`,
	}
})
