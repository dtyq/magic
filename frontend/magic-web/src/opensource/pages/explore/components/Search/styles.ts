import { createStyles } from "antd-style"

const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => {
	return {
		searchGroup: css`
			flex: 1;
			display: flex;
			align-items: center;
			position: relative;
		`,
		search: css`
			font-size: 16px;
			height: 50px;
			width: 100%;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
			background: transparent;

			.${prefixCls}-select-selector {
				border-radius: 50px;
				padding: 0 18px;
				box-shadow:
					0px 4px 14px 0px rgba(0, 0, 0, 0.1),
					0px 0px 1px 0px rgba(0, 0, 0, 0.3);
				.${prefixCls}-select-selection-search-input {
					padding-left: 36px !important;
				}
				.${prefixCls}-select-selection-placeholder {
					padding-left: 36px;
				}
				.${prefixCls}-select-selection-item {
					padding-inline-start: 36px;
					color: ${isDarkMode
						? token.magicColorScales.grey[4]
						: token.magicColorUsages.text[0]};
				}
			}
		`,
		searchIcon: css`
			position: absolute;
			z-index: 1;
			left: 18px;
		`,
		searchSuffix: {
			display: "flex",
			padding: "4px 8px",
			alignItems: "center",
			borderRadius: "100px",
			border: `1px solid ${token.colorBorder}`,
			backgroundColor: token.magicColorScales.grey[0],
		},
		searchPopup: css`
			border-radius: 12px;
			padding: 10px;
			// max-height: 500px;
			// overflow-y: auto;
			// &::-webkit-scrollbar {
			// 	width: 4px;
			// }
			// &::-webkit-scrollbar-button {
			// 	// background-color: ${token.magicColorUsages.white};
			// }
			// &::-webkit-scrollbar-thumb {
			// 	background: ${token.magicColorScales.grey[2]};
			// }
		`,
		searchList: css`
			.rc-virtual-list-scrollbar {
				border-radius: 100px;
				width: 4px !important;
			}
			.rc-virtual-list-scrollbar-thumb {
				background-color: ${token.magicColorScales.grey[2]} !important;
			}
		`,
		searchOption: css`
			border-radius: 8px;
			padding: 8px;
			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		searchOptionActive: css`
			background-color: ${token.magicColorUsages.fill[0]};
		`,
	}
})

export default useStyles
