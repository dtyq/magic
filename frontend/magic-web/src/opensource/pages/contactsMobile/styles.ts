import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive }) => {
	// Base styles
	const baseContainer = css`
		display: flex;
		flex-direction: column;
		background-color: ${token.magicColorUsages.bg[0]};
		min-height: 100%;
	`

	// Responsive styles
	const responsiveContainer = css`
		${responsive.mobile} {
			padding: 12px 12px 0;
		}

		${responsive.tablet} {
			padding: 12px 16px 0;
		}

		${responsive.desktop} {
			padding: 12px 24px 0;
		}
	`

	const cardContainer = css`
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 10px;
		border: 1px solid rgba(28, 29, 35, 0.01);
		display: flex;
		flex-direction: column;
	`

	const sectionTitle = css`
		font-size: ${token.magicFontUsages.response.text12px};
		color: rgba(28, 29, 35, 0.6);
		line-height: 16px;
		margin-bottom: 10px;
		font-weight: 400;
	`

	const listItem = css`
		display: flex;
		align-items: center;
		padding: 5px 0;
		cursor: pointer;
		transition: background-color 0.2s;

		&:hover {
			background-color: rgba(28, 29, 35, 0.02);
		}
	`

	const iconContainer = css`
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		flex-shrink: 0;
	`

	const companyAvatar = css`
		width: 42px;
		height: 42px;
		border-radius: 8px;
		background-color: #fcfcfc;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		border: 1px solid rgba(28, 29, 35, 0.01);
	`

	const textContent = css`
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	`

	const primaryText = css`
		font-size: ${token.magicFontUsages.response.text14px};
		color: rgba(28, 29, 35, 0.8);
		line-height: 20px;
		font-weight: 400;
		flex: 1;
	`

	const companyName = css`
		font-size: ${token.magicFontUsages.response.text16px};
		color: rgba(28, 29, 35, 0.8);
		line-height: 22px;
		font-weight: 600;
	`

	const badge = css`
		display: inline-flex;
		align-items: center;
		width: fit-content;
		gap: 2px;
		background-color: #ffffff;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 4px;
		padding: 3px 6px;
		font-size: ${token.magicFontUsages.response.text10px};
		color: rgba(28, 29, 35, 0.8);
		line-height: 11px;
	`

	const chevronIcon = css`
		width: 18px;
		height: 18px;
		color: rgba(28, 29, 35, 0.6);
		flex-shrink: 0;
	`

	const connectionIcon = css`
		width: 20px;
		height: 20px;
		margin-right: 8px;
		color: rgba(28, 29, 35, 0.35);
	`

	const quickActionIcon = css`
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		flex-shrink: 0;
	`

	const partnerCompanyAvatar = css`
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background-color: #fcfcfc;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		border: 1px solid rgba(28, 29, 35, 0.01);
		flex-shrink: 0;
	`

	return {
		container: css`
			${baseContainer}
			height: 100%;
		`,
		content: css`
			${responsiveContainer}
			background-color: ${token.magicColorScales.grey[0]};
			min-height: 100%;
		`,

		title: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: ${token.magicFontUsages.response.text18px};
			font-style: normal;
			font-weight: 600;
			line-height: 24px;
		`,

		// Main card styles
		card: cardContainer,
		sectionTitle,

		// Company info styles
		companyInfo: css`
			display: flex;
			align-items: center;
			padding: 8px 0 0;
			margin-bottom: 8px;
		`,
		companyAvatar,
		companyDetails: textContent,
		companyName,
		mainOrgBadge: badge,
		mainOrgIcon: css`
			width: 12px;
			height: 12px;
		`,
		mainOrgText: css`
			font-size: ${token.magicFontUsages.response.text10px};
			color: rgba(28, 29, 35, 0.8);
		`,

		// Department styles
		departmentItem: css`
			${listItem}
			padding: 8px 0;
			border-radius: 8px;
		`,
		departmentText: primaryText,
		connectionIcon,
		chevronIcon,

		// Partner styles
		partnerItem: css`
			${listItem}

			border-radius: 8px;

			padding: 5px 0;
			margin-bottom: 4px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
		partnerIcon: css`
			width: 20px;
			height: 20px;
		`,
		partnerCompanyAvatar,
		itemText: primaryText,

		// Quick actions styles
		quickActions: css`
			display: flex;
			flex-direction: column;
			gap: 0;
		`,
		quickActionItem: css`
			${listItem}
			background-color: #ffffff;
			border-radius: 8px;
			padding: 12px;
			margin-bottom: 8px;
			border: 1px solid rgba(28, 29, 35, 0.01);
		`,
		quickActionIcon,

		// Icon container with background
		iconContainer: css`
			${iconContainer}
		`,
	}
})
