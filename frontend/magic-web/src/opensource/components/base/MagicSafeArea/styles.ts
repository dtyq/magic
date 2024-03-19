import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		safeArea: css`
			width: 100%;
			flex: none;
			background-color: transparent;
		`,
		top: css`
			height: ${token.safeAreaInsetTop};
		`,
		bottom: css`
			height: ${token.safeAreaInsetBottom};
		`,
	}
})
