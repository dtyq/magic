import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	layout: css`
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
	`,
	header: css`
		padding: 10px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: ${token.magicColorUsages.text[1]};
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: 22px; /* 137.5% */
		border-bottom: 1px solid ${token.magicColorUsages.border};
		backdrop-filter: blur(12px);
	`,
	close: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all linear 0.1s;
		border-radius: 6px;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}

		&:active {
			background-color: ${token.magicColorUsages.fill[1]};
		}
	`,
	wrapper: css`
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 0;
	`,
	wrapperHeader: css`
		padding: 0 10px;
		height: 32px;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,
	formItem: css`
		margin-bottom: 0;

		& .${prefixCls}-form-item-label::after {
			display: none !important;
		}
	`,
	wrapperBody: css`
		width: 100%;
		min-height: 300px;
		max-height: 70vh;

		& .simplebar-content {
			padding: 0 10px 0 10px !important;
		}
	`,
	item: css`
		display: flex;
		padding: 12px;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 8px;
		align-self: stretch;
		border-radius: 8px;
		border: 1px solid ${token.magicColorUsages.border};
		background-color: ${token.magicColorUsages.white};
		margin-bottom: 4px;

		&:last-child {
			margin-bottom: 0;
		}
	`,
	itemWrapper: css`
		width: 100%;
		display: flex;
		gap: 8px;
		cursor: pointer;
	`,
	itemIcon: css`
		width: 50px;
		height: 50px;
		flex: none;
		border-radius: 8px;
		overflow: hidden;
	`,
	itemFooter: css`
		display: flex;
		align-items: center;
	`,
	itemContainer: css`
		flex: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
	`,
	itemNav: css`
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	`,
	itemName: css`
		margin-right: auto;
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: 22px; /* 137.5% */
	`,
	itemDesc: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[3]};
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px; /* 133.333% */
	`,
	itemTag: css`
		display: flex;
		height: 20px;
		padding: 2px 8px;
		align-items: center;
		gap: 2px;
		border-radius: 3px;
		background-color: ${token.magicColorUsages.fill[0]};
		cursor: pointer;

		& span {
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		}
	`,
	itemButton: css`
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		transition: all linear 0.1s;
	`,
	itemButtonActive: css`
		transform: rotate(90deg);
	`,
	itemActive: css`
		background-color: ${token.magicColorScales.grey[0]};
	`,
	tag: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[3]};
		text-overflow: ellipsis;
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px; /* 133.333% */
	`,
	primary: css`
		color: ${token.magicColorUsages.primary.default};
	`,
	font: css`
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		overflow: hidden;
	`,
	divider: css`
		margin: 0 !important;
	`,
	subWrapper: css`
		width: 100%;
	`,
	subHeader: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-style: normal;
		font-weight: 600;
		line-height: 20px; /* 142.857% */
		margin: 10px 0;
	`,
	subScroll: css`
		width: 100%;
		max-height: 220px;

		& .simplebar-content {
			padding: 0 !important;
		}
	`,
	subItem: css`
		width: 100%;
		display: flex;
		padding: 12px;
		justify-content: space-between;
		align-items: flex-start;
		gap: 4px;
		align-self: stretch;
		border-radius: 12px;
		overflow: hidden;
		background-color: ${token.magicColorUsages.white};
		margin-bottom: 10px;
		cursor: pointer;

		&:last-child {
			margin-bottom: 0;
		}

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};

			.${prefixCls}-btn {
				background: ${token.magicColorUsages.white};
			}
		}
	`,
	subItemNav: css`
		flex: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	`,
	subItemName: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-style: normal;
		font-weight: 600;
		line-height: 20px; /* 142.857% */
	`,
	subItemDesc: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px; /* 133.333% */
	`,
	subItemMenu: css`
		width: 76px;
		height: 100%;
		flex: none;
		display: flex;
		align-items: center;

		& .${prefixCls}-btn-icon {
			display: flex;
			align-items: center;
		}
	`,
	secondaryButton: css`
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		background-color: ${token.magicColorUsages.fill[0]} !important;
		border-color: ${token.magicColorUsages.border} !important;
		color: ${token.magicColorUsages.text[1]} !important;

		&:hover {
			background-color: ${token.magicColorUsages.fill[1]} !important;
		}

		&:active {
			background-color: ${token.magicColorUsages.fill[2]} !important;
		}

		& .${prefixCls}-btn {
			gap: 4px;
		}

		& .${prefixCls}-btn-icon {
			display: flex;
			align-items: center;
		}
	`,
	addToolButton: css`
		width: 100%;
		margin-bottom: 10px;
		gap: 4px;
	`,
}))
