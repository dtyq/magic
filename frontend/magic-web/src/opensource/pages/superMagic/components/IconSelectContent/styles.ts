import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		tabs: css`
			.${prefixCls}-tabs-nav {
				padding: 6px 6px 0 6px;
				margin-bottom: 0;
				.${prefixCls}-tabs-tab-btn {
					display: inline-flex;
					align-items: center;
				}
				.${prefixCls}-tabs-nav-list {
					padding-right: 10px;
				}
				.${prefixCls}-tabs-tab {
					padding: 6px 10px;
					font-size: 12px;
					color: ${token.magicColorUsages.text[1]};
					& + .${prefixCls}-tabs-tab {
						margin: 0 0 0 4px;
					}
					.${prefixCls}-tabs-tab-icon {
						&:not(:last-child) {
							margin-inline-end: 4px;
						}
					}
				}
			}
		`,
		tabsPopup: css`
			z-index: 1200;
		`,
		modalContent: css`
			display: flex;
			flex-direction: column;
			height: 100%;
		`,
		colorSection: css`
			padding: 8px 12px;
			border-top: 1px solid ${token.magicColorUsages.border[0]};
			display: flex;
			gap: 10px;
			align-items: center;
			font-size: 12px;
			color: ${token.magicColorUsages.text[1]};
		`,
		colorTitle: css`
			margin: 0 0 12px 0;
			font-size: 14px;
			font-weight: 500;
			color: ${token.magicColorUsages.text[0]};
		`,
		colorItem: css`
			width: 20px;
			height: 20px;
			border-radius: 50%;
			cursor: pointer;
			border: 2px solid white;
			transition: all 0.2s ease;
			&:hover {
				transform: scale(1.1);
			}
		`,
		footer: css`
			border-top: 1px solid ${token.colorBorder};
			padding: 8px 12px;
			border-top: 1px solid ${token.magicColorUsages.border[0]};
			display: flex;
			justify-content: flex-end;
		`,
		titleItem: css`
			padding: 6px;
			border-radius: 8px;
			cursor: pointer;
			color: ${token.magicColorUsages.text[1]};
			font-weight: 600;
			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		activeTitleItem: css`
			background-color: ${token.magicColorUsages.bg[0]};
		`,
	}
})

export const useIconListStyles = createStyles(({ css, token }, { color }: { color: string }) => {
	return {
		content: css`
			width: 100%;
			height: 270px;
			padding: 10px;
			overflow-y: auto;
			gap: 10px;
			display: flex;
			flex-wrap: wrap;
		`,
		search: css`
			border: none;
			border-radius: 0;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		iconSection: css`
			display: flex;
			flex-direction: column;
			flex: 1;
			overflow: hidden;
			border-bottom: 1px solid ${token.colorBorder};
		`,
		empty: css`
			margin: 50px auto;
		`,
		iconItem: css`
			width: 88px;
			height: 64px;
			font-size: 12px;
			cursor: pointer;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
			border-radius: 8px;
			transition: all 0.2s ease;
			color: ${token.magicColorUsages.text[1]};
			border: 1px solid ${token.magicColorUsages.border};
			svg {
				color: black;
			}
			&:hover {
				border: 1px solid ${color};
				color: ${color};
				svg {
					color: ${color};
				}
			}
		`,
		selectedIcon: css`
			border: 1px solid ${color};
			color: ${color};
		`,
	}
})

export const useDragUploadStyles = createStyles(({ css, token }) => {
	return {
		uploadWrapper: css`
			padding: 20px;
			height: 302px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 24px;
		`,
		previewWrapper: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 6px;
		`,
		previewImage: css`
			width: 80px;
			height: 80px;
			border-radius: 25px;
			background-color: ${token.magicColorUsages.primaryLight.default};
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		dragEnteredLoader: css`
			@keyframes spin {
				to {
					transform: rotate(360deg);
				}
			}
			animation: spin 0.8s infinite linear;
			position: relative;
			z-index: 1;
		`,
		dragEntered: css`
			background-color: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
			border: 1px solid ${token.magicColorUsages.primary.default};
		`,
		imagePreviewWrapper: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 50px;
			height: 50px;
			border-radius: 20px;
		`,
		imagePreview: css`
			width: 42px;
			height: 42px;
		`,
		desc: css`
			font-weight: 400;
			color: ${token.magicColorUsages.text[3]};
		`,
	}
})
