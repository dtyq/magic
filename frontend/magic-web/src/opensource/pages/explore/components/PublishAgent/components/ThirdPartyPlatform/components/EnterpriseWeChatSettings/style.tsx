import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		modal: css`
			.${prefixCls}-steps-item-content {
				width: 100%;
				.${prefixCls}-steps-item-description {
					max-width: 100% !important;
				}
			}
			.${prefixCls}-modal-body {
				padding: 8px 10px;
			}
		`,
		steps: css`
			height: 60px;
			display: flex;
			align-items: center;
			.${prefixCls}-steps-item-title::after {
				display: none;
			}
			padding: 0 20px;
			margin-bottom: 10px;
		`,
		form: css`
			.${prefixCls}-form-item {
				label {
					font-size: 12px;
					color: ${token.magicColorUsages.text[2]};
				}
			}
			.${prefixCls}-form-item-explain {
				font-size: 12px;
				color: ${token.magicColorUsages.text[3]};
				margin-top: 4px;
			}
			.${prefixCls}-form-item-label {
				padding-bottom: 6px !important;
			}
		`,
		title: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,
		activeTitle: css`
			color: ${token.magicColorUsages.text[1]};
		`,
		desc: css`
			font-weight: 400;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
		`,
		activeText: css`
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;
		`,
		infoItem: css`
			color: ${token.magicColorUsages.text[2]};
			padding-left: 10px;
		`,
		infoCard: css`
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			padding: 10px;
			background: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.text[1]};
			margin-bottom: 10px;
		`,
		infoCardContent: css`
			padding-bottom: 10px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
		`,
		configGuideTitle: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
			margin-bottom: 8px;
		`,
		noticeBlock: css`
			border-radius: 8px;
			padding-top: 10px;
			border-top: 1px solid ${token.magicColorUsages.border};
			font-size: 12px;
			line-height: 16px;
		`,
		noticeTitle: css`
			font-weight: 500;
			margin-bottom: 8px;
			color: ${token.magicColorUsages.primary.default};
		`,
		bulletPoint: css`
			color: ${token.magicColorUsages.text[2]};
			margin-top: 4px;
		`,
		infoActiveText: css`
			font-size: 12px;
			color: ${token.magicColorUsages.primary.default};
			font-weight: 600;
		`,
		copy: css`
			color: ${token.magicColorUsages.text[1]};
			margin: 0 2px;
			cursor: pointer;
			&:hover {
				opacity: 0.8;
			}
		`,
		formItem: css`
			font-size: 12px;
			line-height: 16px;
			margin-top: 10px;
			height: 32px;
			.${prefixCls}-form-item {
				margin-bottom: 0;
			}
			.${prefixCls}-input-suffix {
				position: absolute;
				height: 32px;
				width: 72px;
				right: 0;
				top: 0;
			}
		`,
		formTitle: css`
			color: ${token.magicColorUsages.text[2]};
		`,
		formDesc: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
		`,
		formInput: css`
			height: 32px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			max-width: 560px;
		`,
		url: css`
			padding: 5px 10px;
			line-height: 20px;
		`,
		copyBlock: css`
			width: 100%;
			height: 100%;
			background-color: ${token.magicColorUsages.fill[0]};
			flex: 0 0 72px;
			cursor: pointer;
			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		iconCopyLink: css`
			color: ${token.magicColorUsages.text[1]};
		`,
		apiConfigSection: css`
			margin-top: 16px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			padding: 16px;
		`,
		sectionTitle: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
			margin-bottom: 12px;
		`,
		ipConfigTip: css`
			margin-top: 12px;
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			line-height: 18px;
		`,
		finishBlock: css`
			height: 282px;
		`,
		iconCheck: css`
			color: ${token.magicColorUsages.success.default};
		`,
		successText: css`
			color: ${token.magicColorUsages.text[1]};
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
		`,
		backBtn: css`
			color: ${token.magicColorUsages.primary.default};
		`,
	}
})
