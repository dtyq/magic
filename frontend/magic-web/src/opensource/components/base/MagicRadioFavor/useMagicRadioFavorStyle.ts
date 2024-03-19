import { createStyles } from "antd-style"

export const useMagicRadioFavorStyle = createStyles(({ css, token }) => {
	// Semi/usage/fill/--color-fill-0
	const containerBG = token.magicColorUsages.fill[0]
	return {
		magicRadioFavor: css`
			display: flex;
			flex-direction: row;
			padding: 3px;
			background: ${containerBG};
			border-radius: 4px;
			font-size: 14px;
		`,
		radioItem: css`
			height: 26px;
			gap: 10px;
			padding: 3px 20px;
			border-radius: 2px 0px 0px 0px;
			display: flex;
			justify-content: center;
			align-items: center;
			cursor: pointer;
		`,
		active: css`
			background: white;
			color: rgba(49, 92, 236, 1);
			font-weight: 600;
			box-shadow: 0px 4px 14px 0px rgba(0, 0, 0, 0.1);
		`,
	}
})
