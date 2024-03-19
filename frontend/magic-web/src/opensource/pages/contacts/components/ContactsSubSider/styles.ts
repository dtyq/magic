import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			width: 240px;
			min-width: 240px;
		`,
		avatar: css`
			border: 1px solid ${token.magicColorUsages.border};
		`,
		innerContainer: css`
			width: 100%;
		`,
		title: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,
		organizationName: css`
			overflow: hidden;
			color: ${token.magicColorUsages.text[1]};
			text-overflow: ellipsis;
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px;
		`,
		collapse: css`
			width: 100%;
		`,
		divider: css`
			width: 100%;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		departmentPathName: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		listAvatar: css`
			padding: 8px;
			color: white;
			border-radius: 8px;
			width: 40px;
			height: 40px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})
