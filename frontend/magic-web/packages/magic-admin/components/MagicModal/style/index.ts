import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ prefixCls, css, token }, { showDivider = true }: { showDivider?: boolean }) => {
		return {
			header: css`
			--${prefixCls}-modal-header-padding: 10px 20px;
			--${prefixCls}-modal-header-margin-bottom: 0;
			--${prefixCls}-modal-header-border-bottom: ${showDivider ? `1px solid ${token.colorBorder}` : "none"};

			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[1]};
			.${prefixCls}-modal-title {
				color: ${token.magicColorUsages.text[1]};
			}
		`,
			headerNoClose: css`
				--${prefixCls}-modal-header-padding: 20px 20px 0 20px;	
				--${prefixCls}-modal-header-border-bottom: none;
		`,
			content: css`
				padding: 0px !important;

				.${prefixCls}-modal-close {
					transform: translateY(-6px);
				}
			`,
			footer: css`
				--${prefixCls}-modal-footer-padding: 12px;
				--${prefixCls}-modal-footer-margin-top: 0;
				--${prefixCls}-modal-footer-border-top: ${showDivider ? `1px solid ${token.colorBorder}` : "none"};
				.${prefixCls}-btn {
					padding: 0 24px;
				}
				.${prefixCls}-btn-default {
					border: none;
				}
				.${prefixCls}-btn-primary {
					--${prefixCls}-color-primary: ${token.magicColorUsages.primary.default};
					--${prefixCls}-color-primary-hover: ${token.magicColorUsages.primary.hover};
				}
			`,
			footerNoClose: css`
				--${prefixCls}-modal-footer-padding: 0 20px 20px 20px;
				--${prefixCls}-modal-footer-border-top: none;
				
				button.${prefixCls}-btn-default {
					border: 1px solid ${token.magicColorUsages.border};
					background-color: ${token.magicColorUsages.bg[0]};
					color: ${token.magicColorUsages.text[2]};
				}
				
			`,
			body: css`
				--${prefixCls}-modal-body-padding: 20px;
				max-height: 70vh;
				overflow-y: auto;
				scrollbar-width: none;
			`,
		}
	},
)
