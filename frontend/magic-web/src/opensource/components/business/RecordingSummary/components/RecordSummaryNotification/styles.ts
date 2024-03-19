import { createStyles } from "antd-style"

export const useRecordSummaryNotificationStyles = createStyles(({ css, token }) => {
	return {
		notificationContent: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			width: 320px;
			max-width: 100%;
		`,

		header: css`
			display: flex;
			align-items: flex-start;
			gap: 12px;
		`,

		avatar: css`
			width: 40px;
			height: 40px;
			flex-shrink: 0;
			border-radius: 8px;
			overflow: hidden;
			margin-top: 2px;
		`,

		textContent: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,

		title: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.colorText};
			margin: 0;
		`,

		description: css`
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			color: ${token.colorTextSecondary};
			margin: 0;
		`,

		actions: css`
			display: flex;
			gap: 12px;
			justify-content: flex-end;
			margin-top: 4px;
		`,

		dismissButton: css`
			height: 32px;
			padding: 0 12px;
			border-radius: 6px;
			border: none;
			background: ${token.colorBgContainer};
			color: ${token.colorTextSecondary};
			font-size: 14px;
		`,

		primaryButton: css`
			height: 32px;
			padding: 0 16px;
			border-radius: 6px;
			border: none;
			background: ${token.colorPrimary};
			color: ${token.colorWhite};
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover {
				background: ${token.colorPrimaryHover};
				color: ${token.colorWhite};
				box-shadow: none;
			}

			&:focus {
				outline: none;
				box-shadow: 0 0 0 2px ${token.colorPrimaryBg};
			}
		`,
	}
})
