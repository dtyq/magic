import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		layout: css`
			width: 100%;
			height: 100vh;
			display: flex;
			flex-direction: column;
			background-color: ${token.colorBgBase};
		`,
		header: css`
			width: 100%;
			height: 60px;
			flex: none;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 16px;
			border-bottom: 1px solid #1c1d2314;
		`,
		wrapper: css`
			flex: auto;
			height: calc(100vh - 60px);
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
		menuWrapper: css`
			flex: 1;
			display: flex;
			justify-content: center;
			overflow: hidden;
		`,
		actions: css`
			flex-shrink: 0;
		`,
		orgSelect: css`
			width: 140px;
		`,
		langSelect: css`
			width: 110px;
		`,
	}
})
