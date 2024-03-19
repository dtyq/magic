import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => ({
	icon: {
		color: token.magicColorUsages.text[3],
	},
	text: css`
		color: ${token.magicColorUsages.text[3]};
		text-align: justify;
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
	`,
	group: css`
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 6px;
		width: fit-content;
		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
			transition: background-color 0.3s ease;
		}
	`,
	error: css`
		color: ${token.magicColorUsages.danger.default};
		text-align: justify;
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
	`,
	resendIcon: css`
		cursor: pointer;
		fill: ${token.magicColorUsages.danger.default};
	`,
}))

export default useStyles
