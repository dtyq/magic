import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		thirdPartyAppList: css`
			margin-bottom: 12px;
		`,
		platformBlock: css`
			width: 220px;
			height: 180px;
			border-radius: 12px;
			gap: 10px;
			padding-top: 14px;
			padding-bottom: 14px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
			position: relative;
		`,
		platformImage: css`
			svg {
				width: 60px;
				height: 60px;
				border-radius: 50%;
				margin-bottom: 10px;
			}
		`,
		active: css`
			border-width: 2px;
			border-color: ${token.magicColorScales.brand[5]};
		`,
		checkIcon: css`
			position: absolute;
			right: -1px;
			top: -1px;
			width: 32px;
			height: 32px;
			background-color: ${token.magicColorScales.brand[5]};
			border-radius: 0 12px 0 12px;
		`,
		img: css`
			width: 60px;
			height: 60px;
			margin-bottom: 10px;
			border-radius: 50%;
		`,
		disabled: css`
			.platform-title {
				color: ${token.magicColorUsages.text[3]};
			}
			cursor: not-allowed;
		`,
		willSupportBlock: css`
			background-color: ${token.magicColorScales.grey[2]};
			color: ${token.magicColorUsages.white};
			border-radius: 3px;
			height: 20px;
			padding-top: 2px;
			padding-right: 8px;
			padding-bottom: 2px;
			padding-left: 8px;
			position: absolute;
			right: 11px;
			top: 11px;
		`,
		form: css`
			.${prefixCls}-form-item {
				margin-bottom: 0;
			}
			.${prefixCls}-form-item-label {
				padding-bottom: 6px !important;
				label {
					color: ${token.magicColorUsages.text[2]};
				}
			}
		`,
	}
})
