import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, token },
		{
			safeAreaInsetBottom,
			safeAreaInsetTop,
		}: { safeAreaInsetBottom?: number | string; safeAreaInsetTop?: number | string },
	) => ({
		container: css`
			height: calc(100% - 56px - 56px - ${safeAreaInsetBottom} - ${safeAreaInsetTop});
			overflow-y: auto;
			overflow-x: hidden;
			-webkit-overflow-scrolling: touch;
			background-color: ${token.magicColorScales.grey[0]};
		`,
	}),
)
