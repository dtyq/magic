import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	modalWrap: css`
		.magic-modal-body {
			max-height: 60vh;
			overflow-y: auto;
		}
		.ant-input-affix-wrapper {
			width: auto;
		}
	`,

	header: css`
		margin-bottom: 8px;

		.magic-input-affix-wrapper {
			flex: 1;
		}
	`,

	emptyTips: css`
		font-size: 14px;
		font-weight: 400;
		color: rgba(28, 29, 35, 0.6);
	`,
}))
