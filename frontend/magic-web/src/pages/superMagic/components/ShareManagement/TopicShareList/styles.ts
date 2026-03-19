import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`,
		header: css`
			display: flex;
			padding: 20px;
			align-items: center;
			gap: 10px;
			align-self: stretch;
			border-bottom: 1px solid ${token.magicColorUsages.border};
			backdrop-filter: blur(12px);
			justify-content: space-between;
			height: 76px;
		`,
		headerWrapper: css`
			display: flex;
			align-items: center;
			gap: 8px;
			height: 100%;
		`,
		headerIcon: css`
			width: 30px;
			height: 30px;
			border-radius: 8px;
			display: flex;
			justify-content: center;
			align-items: center;
			background: linear-gradient(
				51deg,
				rgba(71, 118, 230, 1) 0%,
				rgba(142, 84, 233, 1) 100%
			);
		`,
		headerInfo: css`
			display: flex;
			flex-direction: column;
		`,
		headerTitle: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px;
		`,
		headerDesc: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,
		headerClose: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		searchWrapper: css`
			width: 100%;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 10px;
			padding: 12px 12px 0 12px;
			margin-bottom: 10px;
		`,
		searchInput: css`
			width: 240px;
			height: 32px;
		`,
		batchButton: css`
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 6px 12px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background: transparent;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			cursor: pointer;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,
		tableHeader: css`
			width: 100%;
			padding: 0 12px 0 12px;
			height: 44px;
		`,
		body: css`
			width: 100%;
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			padding: 0 12px 12px 12px;
		`,
		scrollContainer: css`
			width: 100%;
			height: 100%;
		`,
		table: css`
			width: 100%;
			min-width: 600px;
			display: flex;
			flex-direction: row;
		`,
		column: css`
			display: flex;
			flex-direction: column;
		`,
		columnCheckbox: css`
			width: 50px;
			flex: none;
		`,
		columnTopic: css`
			flex: 1;
			min-width: 200px;
			max-width: 400px;
		`,
		columnShareType: css`
			width: 200px;
			flex: none;
		`,
		columnOperation: css`
			width: 160px;
			flex: none;
		`,
		headerCell: css`
			width: 100%;
			height: 44px;
			padding: 0 10px;
			display: flex;
			align-items: center;
			background-color: #f9f9f9;
			border-bottom: 1px solid ${token.magicColorUsages.border};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			color: #1c1d23;
		`,
		cell: css`
			width: 100%;
			height: 53px;
			padding: 6px 10px;
			display: flex;
			align-items: center;
			border-bottom: 1px solid ${token.magicColorUsages.border};
			font-size: 14px;
			line-height: 20px;
			color: #1c1d23;
		`,
		checkboxCell: css`
			justify-content: center;
			padding: 6px 10px;

			.ant-checkbox-wrapper {
				margin: 0;
			}
			.magic-checkbox {
				border: 1px solid ${token.colorBorder};
			}
		`,
		topicCell: css`
			flex-direction: row;
			align-items: flex-start !important;
			gap: 4px;
		`,
		topicIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 2px;
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[1]};
		`,
		topicContent: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 4px;
			min-width: 0;
			overflow: hidden;
		`,
		topicName: css`
			width: 100%;
			display: flex;
			align-items: center;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		projectTag: css`
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 2px 4px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
			font-size: 10px;
			line-height: 13px;
			color: ${token.magicColorUsages.text[2]};
			width: fit-content;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		externalLink: css`
			width: 13px;
			height: 13px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			color: ${token.magicColorUsages.text[2]};

			&:hover {
				color: ${token.magicColorUsages.primary.default};
			}
		`,
		shareTypeCell: css`
			gap: 8px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		shareTypeIcon: css`
			width: 20px;
			height: 20px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		`,
		shareTypeIconStopShare: css`
			background-color: #ff4d3a;
		`,
		shareTypeIconOrganization: css`
			background-color: #315cec;
		`,
		shareTypeIconInternet: css`
			background-color: #ffa400;
		`,
		operationCell: css`
			gap: 8px;
			white-space: nowrap;
		`,
		operationButton: css`
			padding: 0;
			border: none;
			background: none;
			color: #315cec;
			cursor: pointer;
			font-size: 14px;
			line-height: 20px;

			&:hover {
				text-decoration: underline;
			}
		`,
		loadingFooter: css`
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 4px;
			padding: 4px 0;
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		loaderIcon: css`
			animation: spin 1s linear infinite;
			@keyframes spin {
				from {
					transform: rotate(0deg);
				}
				to {
					transform: rotate(360deg);
				}
			}
		`,
		reachedBottomFooter: css`
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 10px;
			padding: 10px 0;
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		dividerLine: css`
			width: 42px;
			height: 0;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,

		// Mobile styles
		mobileList: css`
			display: flex;
			flex-direction: column;
			gap: 2px;
			padding: 10px;
		`,
		mobileCard: css`
			display: flex;
			align-items: flex-start;
			gap: 10px;
			padding: 10px;
			background-color: #fff;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
		`,
		mobileCardCheckbox: css`
			flex-shrink: 0;
			padding-top: 2px;
		`,
		mobileCardContent: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 10px;
			min-width: 0;
		`,
		mobileCardMain: css`
			display: flex;
			align-items: flex-start;
			gap: 10px;
		`,
		mobileCardIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 2px;
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[1]};
		`,
		mobileCardInfo: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 4px;
			min-width: 0;
		`,
		mobileCardTitle: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.colorText};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		mobileCardProject: css`
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 2px 4px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
			font-size: 10px;
			line-height: 13px;
			color: ${token.magicColorUsages.text[2]};
			width: fit-content;
		`,
		mobileCardExternalLink: css`
			width: 13px;
			height: 13px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			color: ${token.magicColorUsages.text[2]};

			&:hover {
				color: ${token.magicColorUsages.primary.default};
			}
		`,
		mobileCardFooter: css`
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 10px;
		`,
		mobileCardShareType: css`
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.colorText};
		`,
		mobileCardActions: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		mobileCardActionButton: css`
			padding: 0;
			border: none;
			background: none;
			color: #315cec;
			cursor: pointer;
			font-size: 14px;
			line-height: 20px;

			&:hover {
				text-decoration: underline;
			}
		`,
	}
})
