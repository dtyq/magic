import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css }) => {
	return {
		phoneInputWrapper: css`
			width: 100%;
			margin-bottom: 0;
			.${prefixCls}-form-item-control-input-content {
				display: flex;
				gap: 10px;
				// align-items: flex-end;
			}
		`,
		phoneInput: css`
			width: 100%;
			margin-bottom: 0;
			align-self: flex-end;
		`,
	}
})
