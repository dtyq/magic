import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			position: relative;
			background: ${token.colorBgContainer};
			border-radius: 10px 10px 0 0;
			padding: 20px;
		`,

		mask: css`
			background: ${token.magicColorUsages.overlay.bg};
			backdrop-filter: blur(2.5px);
		`,

		closeButton: css`
			position: absolute;
			top: 12px;
			right: 12px;
			z-index: 10;
		`,

		content: css`
			padding: 20px 0;
		`,

		avatarContainer: css`
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
		`,

		avatar: css`
			width: 70px;
			height: 70px;
			border-radius: 4px;
			object-fit: cover;
		`,

		title: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 600;
			font-size: 16px;
			line-height: 1.375;
			text-align: center;
			color: ${token.colorText};
		`,

		tagsContainer: css`
			width: 100%;
		`,

		tag: css`
			background-color: rgba(240, 177, 20, 0.15) !important;
			border: none !important;
			color: #803f00 !important;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 10px;
			line-height: 1.1;
			padding: 2px 8px;
			border-radius: 3px;
			height: 20px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		description: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 12px;
			line-height: 1.5;
			text-align: center;
			color: rgba(28, 29, 35, 0.35);
			margin: 0 auto;
		`,

		statsContainer: css`
			background: #f9f9f9;
			border-radius: 100px;
			padding: 6px 20px;
			margin: 0 auto;
			width: fit-content;
		`,

		statsLabel: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 10px;
			line-height: 1.1;
			color: rgba(28, 29, 35, 0.6);
		`,

		statsValue: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 600;
			font-size: 12px;
			line-height: 1.333;
			color: ${token.colorText};
		`,

		actionButtons: css`
			margin-top: auto;
		`,

		addButton: css`
			border: 1px solid rgba(28, 29, 35, 0.08);
			background: ${token.colorBgContainer};
			color: ${token.colorText};
			border-radius: 8px;
			height: 40px;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 1.429;

			&:hover {
				border-color: ${token.colorPrimary};
				color: ${token.colorPrimary};
			}
		`,

		conversationButton: css`
			background: #315cec;
			border: none;
			color: white;
			border-radius: 8px;
			height: 44px;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 1.429;

			&:hover {
				background: #2a4fd7;
			}

			&:active {
				background: #1e3ba8;
			}
		`,

		addedButton: css`
			background: rgba(46, 47, 56, 0.05);
			border: 1px solid rgba(28, 29, 35, 0.08);
			color: rgba(28, 29, 35, 0.35);
			border-radius: 8px;
			height: 40px;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 1.429;
			cursor: not-allowed;

			&:hover {
				background: rgba(46, 47, 56, 0.05);
				border-color: rgba(28, 29, 35, 0.08);
				color: rgba(28, 29, 35, 0.35);
			}

			.anticon {
				color: rgba(28, 29, 35, 0.35);
			}
		`,

		chatButton: css`
			background: ${token.colorBgContainer};
			border: 1px solid rgba(28, 29, 35, 0.08);
			color: ${token.colorText};
			border-radius: 8px;
			height: 40px;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 1.429;

			&:hover {
				border-color: ${token.colorPrimary};
				color: ${token.colorPrimary};
			}

			.anticon {
				color: ${token.colorText};
			}
		`,
	}
})
