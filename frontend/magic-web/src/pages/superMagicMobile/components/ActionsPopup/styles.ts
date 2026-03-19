import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive }) => {
	// Base styles
	const basePopupBody = css`
		border-radius: 12px 12px 0px 0px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	`

	const baseContainer = css`
		display: flex;
		flex-direction: column;
		width: 100%;
		background: ${token.magicColorScales.grey[0]};
	`

	return {
		popupBody: css`
			${basePopupBody}
		`,

		container: css`
			${baseContainer}
		`,

		// 标题信息区域
		titleInfo: css`
			border-bottom: 1px solid ${token.magicColorUsages?.border || token.colorBorder};
			width: 100%;
			text-align: center;
			height: 40px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		titleText: css`
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			color: ${token.magicColorUsages?.text?.[2] || "rgba(28, 29, 35, 0.6)"};
		`,

		// 操作按钮容器
		actionsContainer: css`
			display: flex;
			flex-direction: column;
			background-color: ${token.magicColorUsages?.bg?.[0] || "#FFFFFF"};
		`,

		// 危险操作按钮（删除）
		dangerButton: css`
			.action-button-text {
				color: ${token.colorError};
			}
		`,

		// 取消按钮区域
		cancelContainer: css`
			padding-top: 10px;
		`,

		cancelButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 50px;
			background-color: ${token.magicColorUsages?.bg?.[0] || "#FFFFFF"};
			border: 1px solid ${token.magicColorUsages?.border || "rgba(28, 29, 35, 0.08)"};
			border-radius: 8px;
			cursor: pointer;
			transition: background-color 0.2s;

			&:hover {
				background-color: ${token.magicColorUsages?.bg?.[1] || "#F9F9F9"};
			}

			&:active {
				background-color: ${token.magicColorUsages?.bg?.[2] || "#F0F0F0"};
			}
		`,

		cancelButtonText: css`
			font-size: 16px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages?.text?.[1] || "rgba(28, 29, 35, 0.8)"};
		`,

		// 响应式样式
		responsive: css`
			${responsive.mobile} {
				.title-info {
					padding: 12px;
				}

				.action-button,
				.cancel-button {
					height: 48px;
				}
			}
		`,
	}
})
