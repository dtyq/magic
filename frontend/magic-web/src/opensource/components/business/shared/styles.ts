import { createStyles } from "antd-style"

export const useModalFooterStyles = createStyles(({ css, token }) => {
	return {
		footerContainer: css`
			display: flex;
			justify-content: flex-end;
			align-items: center;
			gap: 10px;
			width: 100%;
		`,

		cancelButton: css`
			background: ${token.colorFillTertiary} !important;
			border: 1px solid transparent !important;
			color: ${token.colorTextSecondary} !important;

			&:hover {
				background: ${token.colorFillSecondary} !important;
				border: 1px solid transparent !important;
				color: ${token.colorText} !important;
			}

			&:focus {
				background: ${token.colorFillTertiary} !important;
				border: 1px solid transparent !important;
				color: ${token.colorTextSecondary} !important;
			}
		`,

		secondaryButton: css`
			background: ${token.colorPrimaryBg} !important;
			border: 1px solid transparent !important;
			color: ${token.colorPrimary} !important;

			&:hover {
				background: ${token.colorPrimaryBgHover} !important;
				border: 1px solid transparent !important;
				color: ${token.colorPrimary} !important;
			}

			&:focus {
				background: ${token.colorPrimaryBg} !important;
				border: 1px solid transparent !important;
				color: ${token.colorPrimary} !important;
			}
		`,

		primaryButton: css`
			background: ${token.colorPrimary} !important;
			border: 1px solid ${token.colorPrimary} !important;
			color: ${token.colorWhite} !important;

			&:hover {
				background: ${token.colorPrimaryHover} !important;
				border: 1px solid ${token.colorPrimaryHover} !important;
				color: ${token.colorWhite} !important;
			}

			&:focus {
				background: ${token.colorPrimary} !important;
				border: 1px solid ${token.colorPrimary} !important;
				color: ${token.colorWhite} !important;
			}
		`,
	}
})
