import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	const container = css`
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px;
		border: 1px solid rgba(28, 29, 35, 0.01);
	`

	const partnerItem = css`
		display: flex;
		align-items: center;
		padding: 5px 0;
		cursor: pointer;
		transition: background-color 0.2s;

		&:hover {
			background-color: rgba(28, 29, 35, 0.02);
		}
	`

	const iconContainer = css`
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background-color: #32c436;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		flex-shrink: 0;
	`

	const logoPlaceholder = css`
		width: 20px;
		height: 14px;
		background-color: #f0f0f0;
		border-radius: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 8px;
		color: #666;
		font-weight: 600;
	`

	const partnerText = css`
		flex: 1;
		font-family: "PingFang SC", sans-serif;
		font-size: 14px;
		color: rgba(28, 29, 35, 0.8);
		line-height: 20px;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`

	return {
		container,
		partnerItem,
		iconContainer,
		logoPlaceholder,
		partnerText,
	}
})
