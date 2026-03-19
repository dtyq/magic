import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding: 10px;
			background: ${token.colorBgContainer};
		`,

		section: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,

		sectionHeader: css`
			display: flex;
			align-items: center;
			gap: 4px;
			height: 24px;
			overflow: visible;
		`,

		successIcon: css``,

		failedIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 14px;
			height: 14px;
			background: #ff4d3a;
			border-radius: 50%;
			color: white;
			font-size: 10px;
		`,

		sectionTitle: css`
			color: rgba(28, 29, 35, 0.8);
			font-family: "PingFang SC", sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			flex: 1;
		`,

		sectionCount: css`
			color: rgba(28, 29, 35, 0.8);
			font-family: "Inter", sans-serif;
			font-size: 10px;
			font-weight: 400;
			line-height: 1.3;
		`,

		contentArea: css`
			background: #f9f9f9;
			border: 1px solid rgba(28, 29, 35, 0.08);
			border-radius: 8px;
			padding: 10px;
			max-height: 77px;
			overflow-y: auto;
		`,

		resultItem: css`
			color: rgba(28, 29, 35, 0.8);
			font-family: "PingFang SC", sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 1.3333333333333333;
			margin-bottom: 4px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
	}
})
