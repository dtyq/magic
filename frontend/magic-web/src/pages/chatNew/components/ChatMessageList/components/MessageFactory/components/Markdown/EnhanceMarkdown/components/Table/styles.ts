import { createStyles } from "antd-style"

export const useTableStyles = createStyles(({ css, token, responsive, prefixCls }) => ({
	tableContainer: css`
		position: relative;
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
		width: fit-content;
		max-width: 100%;
		overflow-x: auto;

		table {
			width: 100%;
			border-collapse: separate;
			border-spacing: 0;
			overflow-x: auto;
		}
	`,

	showMoreButton: css`
		color: ${token.colorPrimary};
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		font-size: var(--${prefixCls}-markdown-font-size);
		transition: color 0.2s;

		&:hover {
			color: ${token.colorPrimaryHover};
		}

		&:active {
			color: ${token.colorPrimaryActive};
		}

		&:focus {
			color: ${token.colorPrimaryHover};
		}

		${responsive.mobile} {
			font-size: 11px;
		}
	`,

	detailForm: css`
		display: flex;
		flex-direction: column;
	`,

	formValueContent: css`
		padding: 8px 12px;
		background: ${token.colorFillAlter};
		border: 1px solid ${token.colorBorder};
		border-radius: 6px;
		min-height: 20px;
		word-wrap: break-word;
		white-space: pre-wrap;
		color: ${token.colorText};
		font-size: 14px;
	`,

	longText: css`
		cursor: pointer;
		position: relative;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: all 0.3s ease;

		&:not(.expanded) {
			max-width: 200px;
		}

		&.expanded {
			white-space: pre-wrap;
			word-wrap: break-word;
			max-width: none;
		}

		&:hover {
			background-color: ${token.colorPrimaryBg};
		}
	`,

	mobileTable: css`
		${responsive.mobile} {
			font-size: 12px;
		}
	`,

	moreColumnHeader: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		width: max-content;

		.switch-container {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 10px;
			color: ${token.colorTextSecondary};
		}

		.ant-switch {
			transform: scale(0.8);
		}

		${responsive.mobile} {
			padding: 6px 2px;

			.switch-container {
				font-size: 9px;
				gap: 2px;
			}

			.ant-switch {
				transform: scale(0.7);
			}
		}
	`,
}))
