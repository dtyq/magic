import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	dropdownPanel: css`
		width: 550px;
		background: white;
		border-radius: 8px;
		padding: 0;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
		border: 1px solid ${token.colorBorder};
	`,

	mobileDropdownPanel: css`
		width: 100%;
		border: none;
		box-shadow: none;
		border-radius: 0;
	`,

	closeButton: css`
		position: absolute;
		top: 18px;
		right: 14px;
		width: 24px;
		height: 24px;
		cursor: pointer;
		z-index: 10;
		border-radius: 6px;

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}
	`,

	tabsContainer: css`

		.${prefixCls}-tabs-nav {
			padding: 14px;
			margin-bottom: 0;
            border-bottom: 1px solid ${token.colorBorder};
            
            &::before {
                display: none;
            }

            --${prefixCls}-line-width-bold: 0;
            --${prefixCls}-tabs-horizontal-item-gutter: 10px;
            --${prefixCls}-tabs-item-selected-color: ${token.magicColorUsages.text[1]};
            --${prefixCls}-tabs-item-active-color: ${token.magicColorUsages.text[1]};
            --${prefixCls}-tabs-item-hover-color: ${token.magicColorUsages.text[1]};
		}

		.${prefixCls}-tabs-content {
			padding: 0;
		}

		.${prefixCls}-tabs-tab {
			padding: 4px 10px;
			font-size: 14px;
            border-radius: 6px;
            color: ${token.magicColorUsages.text[1]};
		}

        .${prefixCls}-tabs-tab-btn {
            transition: none;
        }

        .${prefixCls}-tabs-tab-active {
            background: ${token.magicColorUsages.fill[0]};
            font-weight: 600;

            .${prefixCls}-tabs-tab-btn {
                text-shadow: none;
            }
        }
	`,

	tabContent: css`
		padding: 14px;
	`,

	projectTabContent: css`
		padding: 0;
	`,

	hint: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 13px;
		line-height: 1.5;
	`,

	projectHint: css`
		display: flex;
		padding: 8px 14px;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		align-self: stretch;
		border-bottom: 1px solid ${token.colorBorder};
		background: ${token.magicColorUsages.fill[0]};
	`,

	// Upload Tab Styles
	uploadArea: css`
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		padding: 6px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		background: ${token.colorBgContainer};
		width: 100%;

		&:hover {
			border: 1px solid ${token.colorBorder};
			background: ${token.magicColorUsages.fill[0]};
		}

		.${prefixCls}-upload {
			padding: 0;
		}

		.${prefixCls}-upload-drag {
			border: none !important;
			background: transparent !important;
		}

		.${prefixCls}-upload-btn {
			padding: 0 !important;
		}
	`,

	uploadTitle: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
	`,

	// Link Tab Styles
	linkInputWrapper: css`
		width: 100%;
	`,

	linkInput: css`
		.${prefixCls}-input-affix-wrapper {
			padding: 8px 12px;
			border-radius: 6px;
		}
	`,

	linkButton: css`
		width: 100%;
		height: 40px;
		border-radius: 6px;
		font-weight: 500;
	`,

	// Project Tab Styles
	imageGrid: css`
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		max-height: 400px;
		overflow-y: auto;
		padding: 14px;

		/* Custom scrollbar */
		&::-webkit-scrollbar {
			width: 8px;
		}

		&::-webkit-scrollbar-track {
			background: ${token.colorBgContainer};
			border-radius: 4px;
		}

		&::-webkit-scrollbar-thumb {
			background: ${token.colorBorderSecondary};
			border-radius: 4px;

			&:hover {
				background: ${token.colorBorder};
			}
		}
	`,

	imageItem: css`
		position: relative;
		border: 1px solid ${token.colorBorder};
		border-radius: 6px;
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s;
		background: ${token.colorBgContainer};

		&:hover {
			border-color: ${token.colorPrimary};
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		}
	`,

	imageWrapper: css`
		width: 100%;
		height: 100px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fafafa;
		overflow: hidden;
		padding: 8px;

		img {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}
	`,

	imageName: css`
		padding: 6px 8px;
		font-size: 12px;
		color: rgba(0, 0, 0, 0.65);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: white;
		border-top: 1px solid ${token.colorBorderSecondary};
	`,

	loadingPlaceholder: css`
		width: 100%;
		height: 100px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fafafa;
	`,

	emptyState: css`
		text-align: center;
		padding: 60px 20px;
		color: ${token.colorTextSecondary};

		.ant-empty-image {
			margin-bottom: 16px;
		}
	`,

	errorState: css`
		text-align: center;
		padding: 40px 20px;
		color: ${token.colorError};
	`,
}))
