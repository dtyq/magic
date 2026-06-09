import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ isDarkMode, prefixCls, css, token }, { open }: { open: boolean }) => {
		return {
			form: css`
				display: flex;
				flex-direction: column;
				gap: 10px;
			`,
			required: css`
				label {
					&::after {
						content: "*" !important;
						color: ${token.magicColorUsages.danger.default};
					}
				}
			`,
			formItem: css`
				margin-bottom: 0;
				.${prefixCls}-form-item-label {
					width: 180px;
					text-align: start;
					label {
						font-size: 12px;
						color: ${token.magicColorUsages.text[1]};
					}
				}
			`,
			desc: css`
				font-size: 14px;
				color: ${token.magicColorUsages.text[3]};
			`,
			searchGroup: css`
				position: relative;
			`,
			searchIcon: css`
				position: absolute;
				z-index: 1;
				top: 6px;
				left: 6px;
				color: ${token.magicColorUsages.text[3]};
			`,
			search: css`
			.${prefixCls}-select-selector {
					0px 4px 14px 0px rgba(0, 0, 0, 0.1),
					0px 0px 1px 0px rgba(0, 0, 0, 0.3);
				.${prefixCls}-select-selection-search-input {
					padding-left: ${open ? "22px" : "0px"} !important;
				}
				.${prefixCls}-select-selection-placeholder {
					padding-left: ${open ? "22px" : "0px"} !important;
				}
				.${prefixCls}-select-selection-item {
					padding-inline-start: ${open ? "22px" : "0px"} !important;
					color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[0]};
				}
			}
		`,
		}
	},
)
