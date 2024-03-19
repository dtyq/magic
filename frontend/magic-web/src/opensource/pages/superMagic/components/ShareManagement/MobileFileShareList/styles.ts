import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	`,

	searchWrapper: css`
		flex-shrink: 0;
		padding: 10px;
		display: flex;
		gap: 8px;
		align-items: center;
		padding-bottom: 2px;
	`,

	searchInput: css`
		flex: 1;
		border-radius: 8px;

		.ant-input {
			font-size: 14px;
			line-height: 20px;
		}
	`,

	batchButton: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		height: 32px;
		border: 1px solid ${token.magicColorUsages.border};
		background: ${token.magicColorUsages.fill[0]};
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		white-space: nowrap;
		transition: all 0.2s;

		&:hover {
			background: ${token.magicColorUsages.fill[1]};
		}

		&:active {
			background: ${token.magicColorUsages.fill[2]};
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.5;
			background: ${token.magicColorUsages.fill[0]};
		}
	`,

	batchButtonHighlight: css`
		background: ${token.magicColorUsages.primary.default};
		border-color: ${token.magicColorUsages.primary.default};
		color: #ffffff;

		&:hover {
			background: ${token.magicColorUsages.primary.hover};
			border-color: ${token.magicColorUsages.primary.hover};
		}

		&:active {
			background: ${token.magicColorUsages.primary.active};
			border-color: ${token.magicColorUsages.primary.active};
		}
	`,

	selectionHeader: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 8px;
		padding-left: 10px;
	`,

	selectionActions: css`
		display: flex;
		align-items: center;
		gap: 8px;
	`,

	cancelButton: css`
		padding: 6px 12px;
		height: 32px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[1]};
		white-space: nowrap;

		&:hover {
			color: ${token.magicColorUsages.primary.default};
		}

		&:active {
			color: ${token.magicColorUsages.primary.active};
		}
	`,

	listContainer: css`
		flex: 1;
		overflow: hidden;
	`,

	scrollContainer: css`
		width: 100%;
		height: 100%;
	`,

	list: css`
		padding: 10px;
		display: flex;
		padding-top: 0;
		flex-direction: column;
		gap: 2px;
	`,

	listItem: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px;
		transition: background-color 0.2s;
	`,

	listItemSelectionMode: css`
		cursor: pointer;

		&:active {
			background-color: ${token.magicColorUsages.fill[0]};
		}
	`,

	checkboxWrapper: css`
		display: flex;
		align-items: center;
		justify-content: center;
		padding-right: 8px;
	`,

	itemContent: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	`,

	infoRow: css`
		display: flex;
		align-items: center;
		gap: 4px;
	`,

	fileIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		flex-shrink: 0;
		color: ${token.magicColorUsages.text[1]};
	`,

	fileName: css`
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	fileCountTag: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		border-radius: 4px;
		background-color: ${token.magicColorUsages.fill[0]};
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.text[1]};
		flex-shrink: 0;
	`,

	shareTypeTag: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		border-radius: 4px;
		flex-shrink: 0;
	`,

	shareTypeIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
	`,

	iconStopShareWrapper: css`
		background-color: ${token.magicColorScales.red[4]};
	`,
	iconOrganizationWrapper: css`
		background-color: ${token.magicColorScales.brand[5]};
	`,
	iconInternetWrapper: css`
		background-color: ${token.magicColorScales.amber[5]};
	`,

	shareTypeIconStopShare: css`
		background-color: ${token.magicColorScales.red[0]};

		span {
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorScales.red[4]};
		}
	`,

	shareTypeIconInternet: css`
		background-color: #fffbeb;

		span {
			font-size: 12px;
			line-height: 16px;
			color: #ffa400;
		}
	`,

	shareTypeIconOrganization: css`
		background-color: #eef3fd;

		span {
			font-size: 12px;
			line-height: 16px;
			color: #315cec;
		}
	`,

	projectRow: css`
		display: flex;
		gap: 10px;
		padding: 0px 24px;
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

	moreButton: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		color: ${token.magicColorUsages.text[1]};
		border-radius: 8px;
		flex-shrink: 0;

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}

		&:active {
			background: ${token.magicColorUsages.fill[1]};
		}
	`,

	divider: css`
		height: 1px;
		background: rgba(28, 29, 35, 0.08);
	`,

	loadingFooter: css`
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 20px 0;
		font-size: 14px;
		color: ${token.magicColorUsages.text[2]};
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
		display: flex;
		align-items: center;
		justify-content: center;
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
}))
