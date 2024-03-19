import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	const container = css`
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px;
		border: 1px solid rgba(28, 29, 35, 0.01);
	`

	const companyInfo = css`
		display: flex;
		align-items: center;
		margin-bottom: 4px;
	`

	const companyAvatar = css`
		width: 42px;
		height: 42px;
		border-radius: 8px;
		background-color: #fcfcfc;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8px;
		border: 1px solid rgba(28, 29, 35, 0.01);
		flex-shrink: 0;
	`

	const textContent = css`
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	`

	const companyName = css`
		font-family: "PingFang SC", sans-serif;
		font-size: 16px;
		color: rgba(28, 29, 35, 0.8);
		line-height: 22px;
		font-weight: 600;
	`

	const badgeContainer = css`
		display: flex;
		align-items: flex-start;
		gap: 4px;
	`

	const badge = css`
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background-color: #ffffff;
		border: 1px solid rgba(28, 29, 35, 0.01);
		border-radius: 4px;
		padding: 3px 6px;
		font-family: "PingFang SC", sans-serif;
		font-size: 10px;
		color: rgba(28, 29, 35, 0.8);
		line-height: 11px;
		font-weight: 400;
	`

	const departmentItem = css`
		display: flex;
		align-items: center;
		padding: 10px 0;
		padding-left: 50px;
		cursor: pointer;
		transition: background-color 0.2s;

		&:hover {
			background-color: rgba(28, 29, 35, 0.02);
		}
	`

	const departmentText = css`
		flex: 1;
		font-family: "PingFang SC", sans-serif;
		font-size: 14px;
		color: rgba(28, 29, 35, 0.8);
		line-height: 20px;
		font-weight: 400;
		margin: 0 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`

	return {
		container,
		companyInfo,
		companyAvatar,
		textContent,
		companyName,
		badgeContainer,
		badge,
		departmentItem,
		departmentText,
	}
})
