import { createStyles } from "antd-style"

export const useMagicEmptyFavorStyle = createStyles(({ css, token }) => {
	// Semi/usage/fill/--color-fill-0
	// Semi/usage/border/--color-border
	const textColor = token.magicColorUsages.text[3]
	// usage/text/--semi-color-text-3
	return {
		noDataContainer: css`
			display: flex;
			justify-content: center;
			align-items: center;
			flex-direction: column;
			color: ${textColor};
			width: 100%;
			height: 100%;
			font-size: 14px;
		`,
		img: css`
			width: 200px;
			height: 200px;
		`,
	}
})
