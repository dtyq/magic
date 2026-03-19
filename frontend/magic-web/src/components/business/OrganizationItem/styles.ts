import { createStyles } from "antd-style"

export const useOrganizationListStyles = createStyles(({ isDarkMode, css, token }) => {
	return {
		item: css`
			display: flex;
			padding: 3px 8px 3px 3px;
			align-items: center;
			gap: 8px;
			align-self: stretch;
			justify-content: space-between;
			border-radius: 8px;
			cursor: pointer;
			margin-bottom: 2px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:last-child {
				margin-bottom: 0;
			}
		`,
		itemDisabled: css`
			cursor: no-drop;

			&:hover {
				background-color: unset;
			}
		`,
		itemSelected: css`
			background-color: ${token.magicColorUsages.primaryLight.default};

			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.default} !important;
			}
		`,
		itemActive: css`
			background: ${token.magicColorUsages.primaryLight.default};
		`,
		itemIcon: css`
			display: flex;
			width: 30px;
			height: 30px;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			gap: 10px;
		`,
		itemText: css`
			margin-right: auto;
		`,
		avatar: css`
			color: white !important;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		avatarDisabled: css`
			filter: grayscale(100%);
		`,
	}
})
