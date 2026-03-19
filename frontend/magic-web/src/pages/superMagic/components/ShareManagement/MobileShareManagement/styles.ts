import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			height: 100%;
			overflow: hidden;
		`,
		tabWrapper: css`
			display: flex;
			align-items: center;
			padding: 0 16px;
			border-bottom: 1px solid ${token.colorBorder};
			gap: 2px;
		`,
		tabItem: css`
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 2px;
			padding: 0 8px 0 6px;
			flex: 1;
			height: 42px;
			cursor: pointer;
			color: ${token.colorTextSecondary};
			font-size: 14px;
			line-height: 20px;
			position: relative;

			&:hover {
				color: ${token.colorText};
			}
		`,
		tabItemActive: css`
			color: ${token.colorText};
			font-weight: 600;

			&::after {
				content: "";
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 2px;
				background-color: ${token.colorPrimary};
			}
		`,
		content: css`
			flex: 1;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		`,
	}
})
