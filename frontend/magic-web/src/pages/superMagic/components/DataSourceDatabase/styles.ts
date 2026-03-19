import { createStyles } from "antd-style"

export const useModalStyles = createStyles(({ css, prefixCls }) => ({
	modal: css`
		--${prefixCls}-modal-content-padding: 20px 20px;
		--${prefixCls}-modal-title-line-height: 22px;
		--${prefixCls}-control-height: 24px;
		.${prefixCls}-modal-close {
			top: 19px;
			right: 19px;
		}
		.${prefixCls}-modal-header {
			margin-bottom: 20px;
		}
	`,
}))

export const useStyles = createStyles(({ css, prefixCls, token }) => ({
	form: css`
		.${prefixCls}-form-item {
			--${prefixCls}-form-item-margin-bottom: 8px;
		}
		.${prefixCls}-form-item-label {
			--${prefixCls}-form-vertical-label-padding: 0 0 4px;
		}
		.${prefixCls}-form-item-label > label,
		.${prefixCls}-form-item-required {
			--${prefixCls}-form-label-font-size: 12px;
			--${prefixCls}-form-label-font-weight: 400;
			--${prefixCls}-form-label-line-height: 16px;
			--${prefixCls}-form-label-color: ${token.magicColorUsages?.text?.[1]};
		}
		.${prefixCls}-form-item-explain-error {
			display: none;
		}
	`,

	section: css`
		margin-bottom: 18px;

		&:last-child {
			margin-bottom: 0;
		}
	`,

	sectionTitle: css`
		font-size: 14px;
		font-weight: 600;
		color: ${token.colorText};
		line-height: 20px;
		margin-bottom: 8px;
	`,

	textArea: css`
		resize: none !important;
		height: 100px !important;
	`,

	databaseTypeRadioGroup: css`
		width: 100%;
		display: flex;

		& > * {
			flex: 1;
		}

		.${prefixCls}-radio {
			display: none;
		}
		.${prefixCls}-radio-wrapper {
			--${prefixCls}-radio-wrapper-margin-inline-end: 10px;
		}
		.${prefixCls}-radio-label {
			width: 100%;
			--${prefixCls}-padding-xs: 0;
		}
	`,

	databaseTypeCard: css`
		display: flex;
		align-items: center;
		height: 40px;
		padding: 10px;
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: ${token.colorBgContainer};

		&.selected {
			border-color: ${token.colorPrimary};
			box-shadow:
				0px 4px 14px 0px rgba(0, 0, 0, 0.1),
				0px 0px 1px 0px rgba(0, 0, 0, 0.3);
		}
	`,

	databaseIcon: css`
		margin-right: 10px;
		stroke: rgba(93, 135, 161, 1);
	`,

	postgresqlIcon: css`
		margin-right: 10px;
	`,

	databaseName: css`
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		color: ${token.magicColorUsages?.text?.[1]};
	`,

	ipTip: css`
		background: ${token.magicColorUsages.primaryLight.default};
		border-radius: 8px;
		padding: 10px 20px;
		margin-top: 18px;
	`,

	ipTipText: css`
		color: ${token.magicColorUsages.primary.default};
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
	`,

	ipAddress: css`
		color: ${token.colorPrimary};
		font-weight: 700;
		display: flex;
		margin-top: 8px;
		align-items: center;
		gap: 4px;
	`,

	ipCopyIcon: css`
		stroke: ${token.colorPrimary};
		cursor: pointer;
	`,

	formActions: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 20px;
	`,

	button: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		border-radius: 8px;
	`,

	testButton: css`
		color: ${token.magicColorUsages?.text?.[2]};
		background: transparent !important;
	`,
}))
