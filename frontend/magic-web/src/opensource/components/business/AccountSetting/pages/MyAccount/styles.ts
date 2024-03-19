import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
			width: 100%;
			padding: 20px;
		`,
		borderTop: css`
			border-top: 1px solid ${token.colorBorder};
			padding-top: 20px;
		`,

		borderLess: css`
			border: none;
			border-radius: 0;
			padding: 0;
		`,

		borderBottom: css`
			border-bottom: 1px solid ${token.colorBorder};
		`,

		card: css`
			border: 1px solid ${token.colorBorder};
			border-radius: 12px;
			padding: 20px;
			background: ${token.colorBgContainer};
		`,

		userInfoCard: css`
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 20px;
		`,

		userInfoLeft: css`
			display: flex;
			gap: 10px;
			align-items: flex-start;
			flex: 1;
			min-width: 0;
		`,

		userInfoMain: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			flex: 1;
			min-width: 0;
		`,

		userName: css`
			font-size: 20px;
			line-height: 28px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,

		userContactInfo: css`
			display: flex;
			flex-direction: column;
			gap: 6px;
		`,

		contactItem: css`
			display: flex;
			align-items: center;
			gap: 10px;
		`,

		contactDetail: css`
			display: flex;
			align-items: center;
			gap: 2px;
			min-width: 0;
		`,

		contactIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[1]};
		`,

		contactText: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,

		changeButton: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.colorPrimary};
			cursor: pointer;
			flex-shrink: 0;

			&:hover {
				opacity: 0.8;
			}
		`,

		userInfoRight: css`
			display: flex;
			gap: 10px;
			align-items: center;
			flex-shrink: 0;
		`,

		actionButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			height: 32px;
			padding: 6px 12px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 20px;
			cursor: pointer;
			transition: all 0.2s ease;
		`,

		editButton: css`
			border: 1px solid ${token.colorBorder};
			color: ${token.magicColorUsages.text[1]};

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		logoutButton: css`
			background: ${token.colorErrorBg};
			color: ${token.colorError};
			border: none;

			&:hover {
				background: ${token.colorErrorBgHover};
			}
		`,

		sectionHeader: css`
			display: flex;
			justify-content: space-between;
			align-items: center;
		`,

		sectionLeft: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,

		sectionTitle: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,

		sectionSubtitle: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,

		sectionRight: css`
			display: flex;
			gap: 20px;
			align-items: flex-start;
		`,

		subscriptionInfo: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			align-items: flex-end;
		`,

		subscriptionRow: css`
			display: flex;
			align-items: center;
			gap: 10px;
		`,

		subscriptionName: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 700;
			color: ${token.magicColorUsages.text[0]};
		`,

		renewButton: css`
			display: flex;
			align-items: center;
			gap: 2px;
			padding: 3px 6px;
			font-size: 12px;
			line-height: 16px;
			cursor: pointer;
		`,

		expiryText: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
		`,

		pendingSubscriptions: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 18px;
			background: ${token.magicColorScales.grey[0]};
			border-radius: 12px;
			gap: 10px;
		`,

		pendingChain: css`
			display: flex;
			align-items: center;
			gap: 20px;
		`,

		pendingItem: css`
			display: flex;
			flex-direction: column;
			gap: 2px;
			align-items: center;
		`,

		pendingName: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
		`,

		pendingTime: css`
			font-size: 10px;
			line-height: 13px;
			color: ${token.magicColorUsages.text[2]};
			text-align: center;
			white-space: wrap;
			width: min-content;
		`,

		arrowIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			color: ${token.magicColorUsages.text[1]};
		`,

		divider: css`
			height: 1px;
			width: 100%;
			background: ${token.colorBorder};
			margin: 20px 0;
		`,

		pointsInfo: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			align-items: flex-end;
		`,

		pointsValue: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 700;
			color: ${token.magicColorUsages.text[0]};
		`,

		warningRow: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		warningIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			color: ${token.magicColorUsages.warning.default};
		`,

		warningText: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.warning.default};
		`,

		nextCycleInfo: css``,

		nextCycleText: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			align-items: flex-end;
		`,

		nextCycleDate: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[0]};
		`,

		nextCycleHint: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,

		nextCycleInfoContainer: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 18px;
			background: ${token.magicColorScales.grey[0]};
			border-radius: 12px;
		`,

		departmentHeader: css`
			display: flex;
			align-items: center;
			gap: 4px;
			margin-bottom: 10px;
		`,

		organizationIcon: css`
			width: 24px;
			height: 24px;
			border-radius: 4px;
			overflow: hidden;
			flex-shrink: 0;
			background: ${token.colorFillSecondary};
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		iconImage: css`
			width: 100%;
			height: 100%;
			object-fit: cover;
		`,

		iconPlaceholder: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			font-weight: 600;
			color: ${token.colorText};
			background: ${token.colorPrimaryBg};
			color: ${token.colorPrimary};
		`,

		organizationName: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,

		departmentContent: css`
			display: flex;
			gap: 20px;
			align-items: flex-start;
		`,

		departmentLabels: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			flex-shrink: 0;
		`,

		departmentLabel: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,

		departmentValues: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			flex: 1;
			min-width: 0;
		`,

		departmentValue: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
			word-break: break-word;
		`,

		departmentPhoneRow: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,

		phoneToggle: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			cursor: pointer;
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[1]};
			transition: opacity 0.2s ease;

			&:hover {
				opacity: 0.7;
			}
		`,

		phoneIcon: css`
			width: 16px;
			height: 16px;
		`,
	}
})
