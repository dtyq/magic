import { createStyles } from "antd-style"

export const useCollapseStyles = createStyles(({ css, token }) => ({
	collapse: css`
		cursor: pointer;
		color: ${token.magicColorUsages.text[2]};
	`,

	collapseCard: css`
		max-width: calc(100% - 24px);
	`,

	expandedCard: css`
		max-width: fit-content;
	`,
}))
