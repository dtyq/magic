import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	const avatarText = css`
		font-size: 18px;
		font-weight: 600;
		line-height: 24px;
		color: ${token.colorPrimary};
	`

	return {
		card: css`
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 20px;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,

		avatar: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 40px;
			height: 40px;
			border-radius: 8px;
			background-color: ${token.colorBgContainer};
			border: 1px solid ${token.magicColorUsages.border};
			flex-shrink: 0;
			overflow: hidden;

			&:has(.${avatarText}) {
				background-color: #eef3fd;
				border-color: transparent;
			}
		`,

		logo: css`
			width: 34px;
			height: 34px;
			object-fit: cover;
		`,

		avatarText,

		content: css`
			display: flex;
			flex-direction: column;
			gap: 6px;
			flex: 1;
			min-width: 0;
		`,

		header: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		name: css`
			font-size: 14px;
			font-weight: 600;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
		`,

		badge: css`
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 2px 4px;
			border: 1px solid ${token.colorPrimaryBorder};
			border-radius: 4px;
			font-size: 10px;
			font-weight: 600;
			line-height: 13px;
			color: ${token.colorPrimary};
			white-space: nowrap;
		`,

		tags: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		tag: css`
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 2px 4px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 4px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
			white-space: nowrap;
		`,

		currentButton: css`
			padding: 6px 12px;
			height: 32px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
			flex-shrink: 0;

			&:disabled {
				background-color: transparent;
				color: ${token.magicColorUsages.text[3]};
			}
		`,

		menuButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			padding: 0;
			border-radius: 8px;
			flex-shrink: 0;

			&:hover {
				background-color: ${token.colorBgTextHover};
			}
		`,
	}
})
