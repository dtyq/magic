import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }, { radius }: { radius: number }) => {
	return {
		magicAvatar: css`
			flex-shrink: 0;
		`,
		border: css`
			border: 1px solid ${token.magicColorUsages.border};
		`,
		avatar: {
			backgroundColor: token.magicColorScales.white,
			borderRadius: radius,
		},
	}
})
