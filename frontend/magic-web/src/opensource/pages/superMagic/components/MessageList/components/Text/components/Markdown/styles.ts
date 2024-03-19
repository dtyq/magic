import { createStyles, keyframes } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		viewMore: css`
			display: inline-block;
			background-color: transparent;
			border: none;
			color: ${token.colorPrimary};
			cursor: pointer;
			font-size: 12px;
			font-weight: 400;
			line-height: 20px;
			padding: 0;
			margin: 0 4px;

			&:hover {
				color: ${token.colorPrimaryHover};
			}
		`,
	}
})
