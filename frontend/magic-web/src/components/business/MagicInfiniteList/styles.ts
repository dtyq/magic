import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			width: 100%;
			height: 100%;
			overflow: hidden;
		`,

		list: css`
			width: 100%;
			height: 100%;
			overflow-y: auto;

			.infinite-scroll-component__outerdiv,
			.infinite-scroll-component {
				height: 100%;
			}
		`,

		// Default item styles (can be overridden by props)
		defaultItem: css`
			padding: 12px;
			margin: 0 12px 8px 12px;
			background-color: ${token.colorBgContainer};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages?.border};
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover {
				background-color: ${token.colorBgTextHover};
				border-color: ${token.colorPrimary};
			}

			&:last-child {
				margin-bottom: 0;
			}
		`,

		loadingContainer: css`
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 16px 0;
			width: 100%;
		`,

		loadingSpinner: css`
			width: 40px;
			height: 40px;
		`,

		emptyContainer: css`
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			height: 100%;
			width: 100%;
			color: ${token.colorTextSecondary};
		`,

		errorContainer: css`
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			padding: 24px;
			color: ${token.colorError};
		`,

		errorMessage: css`
			margin-bottom: 16px;
			text-align: center;
		`,

		retryButton: css`
			color: ${token.colorPrimary};
			cursor: pointer;

			&:hover {
				color: ${token.colorPrimaryHover};
			}
		`,
	}
})
