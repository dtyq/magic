import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		header: css`
			--${prefixCls}-modal-header-padding: 10px 20px;
			--${prefixCls}-modal-header-margin-bottom: 0;
			--${prefixCls}-modal-header-border-bottom: 1px solid ${token.colorBorder};

			color: ${token.magicColorUsages.text[1]};

      font-size: 16px;
      font-weight: 600;
      line-height: 22px;
		`,
		content: css`
			padding: 0 !important;

			.${prefixCls}-modal-close {
				transform: translateY(-6px);
			}

			.${prefixCls}-modal-close {
				top: 14px;
			}
		`,
		footer: css`
			--${prefixCls}-modal-footer-padding: 8px 20px;
			--${prefixCls}-modal-footer-margin-top: 0;
			--${prefixCls}-modal-footer-border-top: 1px solid ${token.colorBorder};

      button {
        --${prefixCls}-button-padding-inline: 12px !important;
        min-width: 80px;
      }

      button.${prefixCls}-btn-primary {
        --${prefixCls}-color-primary: ${token.magicColorUsages.primary.default};
        --${prefixCls}-color-primary-hover: ${token.magicColorUsages.primary.hover};
      }

      .${prefixCls}-btn-default {
        border: 0;
      }
		`,
		body: css`
			--${prefixCls}-modal-body-padding: 8px 20px;
		`,
	}
})
