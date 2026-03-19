import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }, open: boolean) => {
	return {
		drawer: css`
			position: relative;
			flex: 0 1 ${open ? "320px" : 0};
			overflow: hidden;
			transition: all 0.2s ease-in-out;
		`,
		drawerContainer: css`
			border-left: 1px solid ${token.magicColorUsages.border};
			width: 320px !important;
			height: 100%;
			position: absolute;
			left: 0;
			top: 0;
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
			align-self: stretch;
			background: ${token.magicColorScales.grey[0]};
		`,
		close: css`
			width: 30px;
			height: 30px;
			position: absolute;
			right: 12px;
			top: 10px;
			z-index: 10;
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
	}
})
