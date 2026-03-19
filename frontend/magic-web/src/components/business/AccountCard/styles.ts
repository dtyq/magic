import { createStyles } from "antd-style"

export const useOrganizationSwitchStyles = createStyles(({ token, css, isDarkMode }) => {
	// Base styles
	const baseContainer = css`
		background: ${isDarkMode
			? token.magicColorScales?.grey?.[9]
			: token.magicColorScales?.grey?.[0]};
		padding-bottom: 56px;
	`

	const baseCard = css`
		background: ${isDarkMode
			? token.magicColorScales?.grey?.[8]
			: token.magicColorUsages?.white};
		border-radius: 8px;
		border: 1px solid ${token.magicColorUsages?.border || "rgba(28,29,35,0.01)"};
		padding: 12px;
	`

	return {
		// Main container
		container: css`
			${baseContainer}
			width: 100%;
			height: 100%;
			overflow: hidden;
		`,

		// Account card
		accountCard: css`
			${baseCard}
			width: 100%;
		`,

		// Platform header
		platformHeader: css`
			font-size: 12px;
			line-height: 16px;
			color: ${isDarkMode
				? token.magicColorScales?.grey?.[4]
				: token.magicColorUsages?.text?.[3]};
		`,

		// Account info section
		accountInfo: css``,

		// Account badge
		accountBadge: css`
			background: ${isDarkMode
				? token.magicColorScales?.grey?.[7]
				: token.magicColorUsages?.bg?.[1]};
			border: 1px solid ${token.magicColorUsages?.border || "rgba(28,29,35,0.01)"};
			border-radius: 4px;
			padding: 4px 8px;
			font-size: 12px;
			line-height: 16px;
			color: ${isDarkMode
				? token.magicColorScales?.grey?.[4]
				: token.magicColorUsages?.text?.[3]};
		`,

		// Account phone
		accountPhone: css`
			font-size: 14px;
			line-height: 20px;
			color: ${isDarkMode
				? token.magicColorScales?.grey?.[3]
				: token.magicColorUsages?.text?.[1]};
		`,

		// Logout button
		logoutButton: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorScales?.brand?.[5] || "#315cec"};
			cursor: pointer;
			transition: opacity 0.2s;

			&:hover {
				opacity: 0.8;
			}
		`,

		// Organization list
		organizationList: css`
			gap: 4px;
		`,

		// Organization item
		organizationItem: css`
			padding: 6px 8px;
			border-radius: 8px;
			cursor: pointer;
			transition: background-color 0.2s;

			&:hover {
				background: ${isDarkMode
					? token.magicColorScales?.grey?.[7]
					: token.magicColorUsages?.fill?.[0]};
			}
		`,

		// Selected organization item
		organizationItemSelected: css`
			background: ${isDarkMode ? token.magicColorScales?.brand?.[8] : "#eef3fd"};

			&:hover {
				background: ${isDarkMode ? token.magicColorScales?.brand?.[8] : "#eef3fd"};
			}
		`,

		// Organization avatar
		organizationAvatar: css`
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border: 1px solid ${token.magicColorUsages?.border || "rgba(28,29,35,0.01)"};
		`,

		// Organization name
		organizationName: css`
			font-size: 14px;
			line-height: 20px;
			color: ${isDarkMode
				? token.magicColorScales?.grey?.[3]
				: token.magicColorUsages?.text?.[1]};
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		// Partner badge
		partnerBadge: css`
			background: ${token.magicColorScales?.brand?.[5] || "#315cec"};
			color: ${token.magicColorUsages?.white};
			font-size: 10px;
			line-height: 14px;
			padding: 2px 6px;
			border-radius: 2px;
			margin-left: 8px;
		`,

		// Check icon
		checkIcon: css`
			color: ${token.magicColorScales?.brand?.[5] || "#315cec"};
		`,

		// Scroll container
		scrollContainer: css`
			height: calc(100% - 40px);
			padding: 10px;
			overflow-y: auto;
		`,
	}
})
