import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	const container = css`
		background-color: #ffffff;
		border-radius: 8px;
		height: 50px;
		display: flex;
		align-items: center;
		padding: 0 12px;
		cursor: pointer;
		transition: background-color 0.2s;
		border: 1px solid rgba(28, 29, 35, 0.01);

		&:hover {
			background-color: rgba(28, 29, 35, 0.02);
		}
	`

	const iconContainer = css`
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		flex-shrink: 0;
	`

	const actionText = css`
		flex: 1;
		font-family: "PingFang SC", sans-serif;
		font-size: 14px;
		color: rgba(28, 29, 35, 0.8);
		line-height: 20px;
		font-weight: 400;
	`

	return {
		container,
		iconContainer,
		actionText,
	}
})
