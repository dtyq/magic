import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	modalWrap: css`
		.magic-modal-body {
			display: flex;
			flex-direction: column;
			max-height: 60vh;
			overflow: hidden;
		}
		.ant-input-affix-wrapper {
			width: auto;
		}
	`,

	header: css`
		flex-shrink: 0;
		margin-bottom: 8px;

		.magic-input-affix-wrapper {
			flex: 1;
		}
	`,

	list: css`
		display: grid;
		min-height: 0;
	`,
	viewport: css`
		height: auto;
		min-height: 0;
		> div {
			display: block !important;
		}
	`,
	emptyTips: css`
		font-size: 14px;
		font-weight: 400;
		color: rgba(28, 29, 35, 0.6);
	`,
}))
