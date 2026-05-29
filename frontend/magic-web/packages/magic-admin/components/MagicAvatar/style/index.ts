import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token, prefixCls }, { radius }: { radius: number }) => {
		return {
			magicAvatar: css`
				flex-shrink: 0;
				--${prefixCls}-border-radius: ${radius}px;
			`,
			border: css`
				border: 1px solid ${token.magicColorUsages.border};
			`,
			avatar: {
				backgroundColor: token.magicColorScales.white,
				borderRadius: radius,
			},
		}
	},
)
