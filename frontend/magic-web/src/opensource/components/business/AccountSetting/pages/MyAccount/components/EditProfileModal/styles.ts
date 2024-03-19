import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	modalContent: css`
		display: flex;
		flex-direction: column;
		gap: 24px;
		width: 100%;
	`,

	avatarSection: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
		width: 100%;
		padding: 20px;
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
	`,

	avatarWrapper: css`
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		padding: 4px;
	`,

	uploadButton: css`
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 32px;
		padding: 6px 12px;
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		background: ${token.colorBgContainer};
		color: ${token.magicColorUsages.text[2]};
		font-size: 14px;
		line-height: 20px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
			border-color: ${token.colorPrimary};
		}
	`,

	formSection: css`
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	`,

	label: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[2]};
	`,

	inputWrapper: css`
		width: 100%;
	`,

	input: css`
		width: 100%;
		height: 40px;
		padding: 0 12px;
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		font-size: 16px;
		line-height: 22px;
		color: ${token.magicColorUsages.text[0]};
		transition: border-color 0.2s ease;

		&:hover {
			border-color: ${token.colorPrimaryHover};
		}

		&:focus {
			border-color: ${token.colorPrimary};
			outline: none;
		}
	`,
}))
