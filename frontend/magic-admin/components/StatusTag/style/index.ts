import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ token, css, prefixCls }, { hasClick }: { hasClick?: boolean }) => ({
		tag: css`
			cursor: ${hasClick ? "pointer" : "default"};
			height: max-content;
			&.${prefixCls}-tag-success {
				color: ${token.magicColorUsages.success.default};
				background-color: ${token.magicColorUsages.successLight.default};
			}
			&.${prefixCls}-tag-error {
				color: ${token.magicColorUsages.danger.default};
				background-color: ${token.magicColorUsages.dangerLight.default};
			}
			&.${prefixCls}-tag-warning {
				color: ${token.magicColorUsages.warning.default};
				background-color: ${token.magicColorUsages.warningLight.default};
			}
			&.${prefixCls}-tag-processing {
				color: ${token.magicColorUsages.primary.default};
				background-color: ${token.magicColorUsages.primaryLight.default};
				border-color: ${token.magicColorUsages.primary.default};
				border-radius: 4px;
			}
			&.${prefixCls}-tag-default {
				color: ${token.magicColorUsages.tertiary.default};
				background-color: ${token.magicColorUsages.tertiaryLight.default};
			}
		`,
	}),
)
