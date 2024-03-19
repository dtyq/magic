import { createStyles } from "antd-style"

export const useDirectoryStyles = createStyles(
	({ token, css }, { isMobile }: { isMobile: boolean }) => ({
		divider: css`
			height: 100%;
			width: 1px;
			background-color: ${token.colorBorderSecondary};
			margin: 10px;
		`,
		container: css`
			height: 100%;
		`,
		content: css`
			flex: 0 0 45%;
			overflow: hidden;
			&:first-child {
				border-right: 1px solid ${token.colorBorderSecondary};
			}
		`,
		mobileContent: css`
			flex: 1;
		`,

		rightHeader: css`
			padding: 0 10px;
			height: 41px;
			border-bottom: 1px solid ${token.magicColorUsages.border};
			background: ${token.colorBgContainer};
		`,

		directoryHeader: css`
			padding: 10px;
			max-width: 100%;
		`,

		breadcrumb: css`
			display: flex;
			align-items: center;
			height: 44px;
			margin: 0 10px;
			overflow: hidden;
			flex: 1;
		`,

		breadcrumbItem: css`
			display: flex;
			align-items: center;

			cursor: pointer;
			border-radius: ${token.borderRadiusSM}px;
			transition: background-color 0.2s;
			max-width: 100%;
			min-width: 0;
			position: relative;
			color: ${token.magicColorUsages.text[0]};

			&:hover:not(.disable):not(.current) {
				color: ${token.colorPrimary};
			}

			&.disable {
				cursor: not-allowed;
				opacity: 0.5;
			}

			&.ellipsis {
				padding: ${token.paddingXXS}px;
				color: white;
				height: 16px;
				background-color: ${token.magicColorScales.grey[3]};
				max-width: 24px;
				min-width: 24px;
			}
		`,

		ellipsisIcon: css`
			color: white;
		`,

		lockIcon: css`
			margin-right: ${token.marginXXS}px;
			color: ${token.colorWarning};
			font-size: 12px;
		`,

		nameContainer: css`
			flex: 1;
		`,

		name: css`
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			max-width: ${isMobile ? "150px" : "400px"};
			line-height: 24px;
		`,

		seperatorIcon: css`
			margin: 0 4px;
			color: ${token.colorTextQuaternary};
			font-size: 12px;
		`,

		searchContainer: css``,

		searchHeader: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px;
			border-bottom: 1px solid ${token.colorBorderSecondary};
			height: 40px;
			margin-bottom: 2px;

			span {
				color: ${token.colorTextHeading};
			}

			div {
				display: flex;
				align-items: center;
				cursor: pointer;
				color: ${token.colorPrimary};
				transition: color 0.2s;

				&:hover {
					color: ${token.colorPrimaryHover};
				}

				span {
					margin-left: ${token.marginXXS}px;
					font-weight: normal;
				}
			}
		`,

		searchHeaderTitle: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 600;
		`,
		searchHeaderReturn: css`
			color: ${token.colorTextSecondary};
			cursor: pointer;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
		`,

		folderContainer: css`
			padding: 0 10px;
			width: 100%;
			height: 282px;
			overflow-y: auto;
		`,
		spinContainer: css`
			height: 100%;
			width: 100%;
		`,

		textFolderItem: css`
			display: flex;
			align-items: center;
			padding: 10px;
			border-radius: ${token.borderRadiusSM}px;
			cursor: pointer;
			transition: all 0.2s;
			margin-bottom: 2px;
			border: none;
			height: 40px;
			gap: 4px;

			&:hover:not(.disable) {
				background-color: ${token.colorBgTextHover};
			}

			&.checked {
				background-color: ${token.colorPrimaryBg};
				border: 1px solid ${token.colorPrimary};
			}

			&.disable {
				cursor: not-allowed;
				opacity: 0.5;
			}

			&:last-child {
				border-bottom: none;
			}
		`,

		folderIconContainer: css`
			background-color: ${token.magicColorUsages.fill[0]};
			width: 24px;
			height: 24px;
			line-height: 24px;
			border-radius: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex: 0 0 24px;
		`,

		fileItemContainer: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex: 1;
			width: 100%;
		`,

		childrenCount: css`
			font-size: ${token.fontSizeSM}px;
			color: ${token.colorTextSecondary};
			margin-left: ${token.marginXS}px;
		`,

		parentPathContainer: css`
			flex: 0 0 500px;
			flex-shrink: 1;
			min-width: 0;
			display: flex;
			align-items: center;
			justify-content: flex-end;
		`,

		parentPathTooltip: css``,

		parentPath: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex: 1;
			text-align: right;
			flex-shrink: 0;
		`,

		icon: css`
			font-size: 20px;
			color: ${token.magicColorUsages.text[2]};
			flex-shrink: 0;
			flex: 0 0 20px;

			&.large {
				font-size: 48px;
				margin-bottom: ${token.marginMD}px;
				margin-right: 0;
			}

			&.chevron {
				font-size: 16px;
				margin-right: 0;
			}
		`,

		input: css``,

		emptyBlock: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
			height: 100%;
			width: 100%;
		`,

		createDirectoryButtonLink: css`
			color: ${token.colorPrimary};
			border: none;
			padding: 0;
			flex-shrink: 0;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			background: none;
			cursor: pointer;
			&:hover {
				color: ${token.colorPrimaryHover};
			}
		`,

		tip: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
			text-align: center;
		`,

		createDirectoryButton: css`
			color: ${token.magicColorUsages.text[2]};
			border: 1px solid ${token.colorBorder};
			padding: 6px 12px;
			flex-shrink: 0;
		`,

		menuItem: css`
			display: flex;
			align-items: center;

			.lock-icon {
				margin-right: ${token.marginXXS}px;
				color: ${token.colorWarning};
				font-size: 12px;
			}

			.name {
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 200px;
			}
		`,

		searchInput: css`
			display: flex;
			width: 140px;
			height: 28px;
			padding: 2px;
			align-items: center;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorUsages.bg[1]};
			input {
				&::placeholder {
					font-size: 12px;
					font-weight: 400;
					line-height: 16px;
					color: ${token.magicColorUsages.text[3]};
					overflow: visible;
				}
			}
		`,

		searchIcon: css`
			color: ${token.magicColorUsages.text[3]};
			margin: 0 8px;
			margin-inline-end: 0;
		`,
	}),
)
