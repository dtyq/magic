import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		modal: css`
			.ant-modal-content {
				border-radius: 12px;
				padding: 0;
				box-shadow:
					0px 0px 1px 0px rgba(0, 0, 0, 0.3),
					0px 4px 14px 0px rgba(0, 0, 0, 0.1);
			}

			.ant-modal-header {
				padding: 0;
				margin: 0;
				border: none;
			}

			.ant-modal-body {
				padding: 0;
			}

			.ant-modal-close {
				top: 24px;
				right: 24px;
				width: 24px;
				height: 24px;
				color: ${token.colorTextSecondary};

				&:hover {
					color: ${token.colorText};
					background-color: transparent;
				}

				.ant-modal-close-x {
					width: 24px;
					height: 24px;
					line-height: 24px;
					font-size: 16px;
				}
			}
		`,

		container: css`
			display: flex;
			flex-direction: column;
			width: 100%;
		`,

		header: css`
			display: flex;
			gap: 12px;
			align-items: flex-start;
			padding: 14px 10px 10px 10px;
		`,

		iconWrapper: css`
			flex-shrink: 0;
			width: 24px;
			height: 24px;
			color: ${token.colorPrimary};
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		textContent: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			flex: 1;
			min-width: 0;
		`,

		title: css`
			font-weight: 600;
			font-size: 18px;
			line-height: 24px;
			color: ${token.colorText};
			margin: 0;
		`,

		description: css`
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: ${token.colorTextSecondary};
			margin: 0;
		`,

		footer: css`
			display: flex;
			gap: 12px;
			align-items: center;
			padding: 14px 10px;
		`,

		feedbackButton: css`
			height: 32px;
			padding: 6px 24px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			border: none;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;

			span {
				font-weight: 400;
				font-size: 14px;
				line-height: 20px;
				color: ${token.colorText};
			}

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,

		closeButton: css`
			flex: 1;
		`,
	}
})
