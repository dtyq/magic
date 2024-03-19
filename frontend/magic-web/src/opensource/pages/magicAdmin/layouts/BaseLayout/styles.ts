import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		layout: css`
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			background-color: ${token.colorBgBase};
		`,
		header: css`
			width: 100%;
			height: 70px;
			flex: none;
			display: flex;
			align-items: center;
			justify-content: center;
			border-bottom: 1px solid #1c1d2314;
			padding: 0 10px;
			z-index: 1000;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		wrapper: css`
			flex: auto;
			height: calc(100vh - 70px);
		`,
		wrapperWithoutMenu: css`
			height: 100vh;
		`,
		title: css`
			font-size: 18px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
			flex-shrink: 0;
		`,
		logo: css`
			padding: 0 10px;
			flex-shrink: 0;
		`,
	}
})
