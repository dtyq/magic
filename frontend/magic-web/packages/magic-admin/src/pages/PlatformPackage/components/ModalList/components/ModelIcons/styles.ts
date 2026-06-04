import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		avatarItem: css`
			position: relative;
		`,
		avatar: css`
			padding: 3px;
			cursor: pointer;
			position: relative;
		`,
		iconCheck: css`
			position: absolute;
			bottom: -10px;
			right: -6px;
			z-index: 999;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.primary.default};
		`,
		iconCheckMark: css`
			position: absolute;
			color: ${token.magicColorUsages.white};
		`,
		iconTrash: css`
			background-color: ${token.magicColorUsages.danger.default};
			color: ${token.magicColorUsages.white};
			border-radius: 50%;
			padding: 2px;
			cursor: pointer;
		`,
		iconList: css`
			flex-wrap: wrap;
		`,
		upload: css`
			border: 1px dashed ${token.magicColorUsages.border};
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[2]};
			padding: 11px;
			height: 46px;
		`,
		desc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
	}
})
