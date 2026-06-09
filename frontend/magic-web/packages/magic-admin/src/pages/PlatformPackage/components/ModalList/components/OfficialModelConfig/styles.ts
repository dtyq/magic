import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		formItem: css`
			margin-bottom: 0;
			.${prefixCls}-form-item-label {
				width: 200px;
				text-align: start;
				color: ${token.magicColorUsages.text[1]};
				label {
					text-wrap-mode: wrap;
				}
			}
		`,
		desc: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		followPricingAlert: css`
			padding: 8px 12px;
			.${prefixCls}-alert-message {
				font-size: 13px;
				line-height: 20px;
			}
		`,
		followPricingHint: css`
			font-size: 12px;
			line-height: 18px;
			color: ${token.magicColorUsages.text[3]};
		`,
		officialModelConfig: css`
			padding: 20px;
			background-color: ${token.magicColorScales.grey[0]};
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		priceInput: css`
			.${prefixCls}-input-group {
				.${prefixCls}-input-group-addon {
					background-color: ${token.magicColorUsages.bg[0]};
					font-size: 14px;
					font-weight: 600;
					color: ${token.magicColorUsages.text[2]};
				}
				.${prefixCls}-input-outlined {
					border-left: none;

					&:not(:last-child) {
						border-right: none;
					}
					&:focus {
						border-left: 1px solid ${token.magicColorUsages.primary.default} !important;
						border-right: 1px solid ${token.magicColorUsages.primary.default};
					}
				}
			}
		`,
		inputNumber: css`
			width: 88%;
			.${prefixCls}-input-number-handler-wrap {
				background-color: ${token.magicColorUsages.bg[0]};
				border-radius: 3px;
				border: 1px solid ${token.magicColorUsages.border};
				opacity: 1 !important;
				width: 18px;
				right: -26px;
				.${prefixCls}-input-number-handler {
					border-left: none;
				}
			}
		`,
		pricingModeSelect: css`
			.${prefixCls}-select-prefix {
				font-size: 12px;
				font-weight: 600;
				color: ${token.magicColorUsages.text[2]} !important;
			}
		`,
		pricingStepHandle: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			color: ${token.magicColorUsages.text[3]};
			flex-shrink: 0;
		`,
		pricingBoundaryInput: css`
			width: 100px;
			.${prefixCls}-input-group-addon {
				padding-inline: 12px;
				font-size: 12px;
				font-weight: 600;
			}
		`,
		pricingValueInput: css`
			width: 100%;
			.${prefixCls}-input-number-group {
				.${prefixCls}-input-number-group-addon {
					padding-inline: 12px;
					font-size: 12px;
					font-weight: 600;
					color: ${token.magicColorUsages.text[2]};
				}
			}
		`,
		tokenRangeText: css`
			flex-shrink: 0;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[0]};
		`,
		pricingActionButton: css`
			width: 32px;
			height: 32px;
			padding: 0 !important;
			border-radius: 8px;
			flex-shrink: 0;
		`,
		disabledText: css`
			color: ${token.magicColorUsages.text[3]};
		`,
		pricingGroup: css`
			padding: 12px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 10px;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		pricingGroupTitle: css`
			font-size: 13px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		pricingRow: css`
			display: grid;
			grid-template-columns: minmax(180px, 0.7fr) minmax(360px, 1.3fr);
			gap: 12px;
			align-items: flex-start;
			padding-top: 10px;
			border-top: 1px solid ${token.magicColorUsages.border};

			&:first-of-type {
				padding-top: 0;
				border-top: none;
			}
		`,
		pricingRowMeta: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			min-width: 0;
		`,
		pricingRowTitle: css`
			font-size: 13px;
			font-weight: 500;
			color: ${token.magicColorUsages.text[1]};
		`,
		pricingRowDesc: css`
			font-size: 12px;
			line-height: 18px;
			color: ${token.magicColorUsages.text[3]};
		`,
		pricingInputGrid: css`
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
		`,
		pricingInputLabel: css`
			font-size: 12px;
			line-height: 18px;
			color: ${token.magicColorUsages.text[3]};
		`,
	}
})
