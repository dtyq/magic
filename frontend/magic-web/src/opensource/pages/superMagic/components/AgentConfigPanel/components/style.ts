import { createStyles } from "antd-style"
export const useStyles = createStyles(({ css, token }) => ({
	modal: css`
		.ant-modal-body {
			padding: 0;
		}

		.ant-tabs-content-holder {
			padding: 0;
		}

		.ant-tabs-tab {
			margin: 0 4px;
		}
	`,
	modalTitle: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid ${token.colorBorder};
		padding-bottom: 20px;
		font-family: PingFang SC;
		font-weight: 600;
		font-style: Semibold;
		font-size: 16px;
		leading-trim: NONE;
		line-height: 22px;
		letter-spacing: 0px;
	`,
	tabContent: css`
		padding: 20px;
		max-height: 450px;
		overflow-y: auto;
	`,
	nestedTabContent: css`
		max-height: 500px;
		overflow-y: auto;
		user-select: none;
	`,
	categorySection: css`
		margin-bottom: 24px;

		&:last-child {
			margin-bottom: 0;
		}
	`,
	categoryHeader: css`
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		font-weight: 600;
		font-size: 16px;
		color: ${token.colorText};
	`,
	categoryIcon: css`
		font-size: 18px;
	`,
	toolGrid: css`
		display: flex;
		flex-direction: column;
		user-select: none;
		padding: 10px 0px;
	`,
	toolItem: css`
		display: flex;
		padding: 10px;
		border-radius: 8px;
		transition: all 0.2s;
		cursor: pointer;
		&:hover {
			background: ${token.colorFillSecondary};
		}
	`,
	toolIcon: css`
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: ${token.colorFillAlter};
		border-radius: 6px;
		margin-right: 12px;
		font-size: 16px;
	`,
	toolInfo: css`
		user-select: none;
		padding-right: 10px;
	`,
	toolName: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		margin-bottom: 6px;
		font-weight: 600;
	`,
	toolCode: css`
		border-radius: 4px;
		background: ${token.colorFillAlter};
		margin-bottom: 6px;
		width: fit-content;
		font-weight: 600;
		font-size: 10px;
		color: ${token.magicColorUsages.text[1]};
	`,
	toolDescription: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.4;
		color: ${token.magicColorUsages.text[2]};
	`,
	addButton: css`
		width: 80px;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		padding: 8px 24px;
		font-size: 14px;
		cursor: pointer;
		margin-left: auto;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		border: 1px solid ${token.colorBorder};
		font-family: PingFang SC;
		font-weight: 400;
		line-height: 20px;
		background: ${token.colorFillAlter};
		&:hover {
			color: ${token.colorPrimaryHover};
		}
	`,
	addedButtonIcon: css`
		background: ${token.colorPrimaryBg}!important;
		color: ${token.colorText};
	`,
	emptyCategory: css`
		text-align: center;
		color: ${token.colorTextTertiary};
		font-size: 14px;
		padding: 20px;
		border: 1px dashed ${token.colorBorder};
		border-radius: 8px;
		background: ${token.colorFillAlter};
	`,
	segmentedContainer: css`
		padding: 20px 20px 0 20px;
		border-bottom: 1px solid ${token.colorBorderSecondary};
	`,
	contentContainer: css`
		height: 100%;
		overflow-y: auto;
		padding: 10px 0px;
	`,
	collapseContainer: css`
		user-select: none;
		.magic-collapse-header {
			height: 40px !important;
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			font-size: 12px;
			color: ${token.colorText};
			background: ${token.colorWhite};
			cursor: pointer;
			&:hover {
				background: ${token.colorFillAlter} !important;
			}
		}

		.magic-collapse-item {
			border: none !important;
		}
		.magic-collapse-content-box {
			background: ${token.colorWhite};
			padding: 0px 24px !important;
		}
		.magic-collapse-expand-icon {
			padding: 0 !important;
		}
	`,
	collapseHeader: css`
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 14px;
		color: ${token.colorText};
	`,
	collapseIcon: css`
		width: 24px;
		height: 24px;
		font-size: 16px;
	`,
	collapseName: css`
		font-family: PingFang SC;
		font-weight: 600;
		font-style: Semibold;
		font-size: 12px;
		leading-trim: NONE;
		line-height: 16px;
		letter-spacing: 0px;
		color: ${token.colorText};
	`,
	addButtonText: css`
		font-size: 14px;
		font-weight: 400;
		color: ${token.magicColorUsages.text[1]};
	`,
}))
