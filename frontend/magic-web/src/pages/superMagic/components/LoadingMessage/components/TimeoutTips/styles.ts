import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	`,

	mainText: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		text-align: left;
	`,

	reasonContainer: css`
		display: flex;
		flex-direction: column;
	`,

	reasonItem: css`
		display: flex;
		align-items: flex-start;
	`,

	dot: css`
		color: ${token.colorText};
		flex-shrink: 0;
		fill: ${token.magicColorUsages.text[1]}!important;
		height: 20px;
		margin-right: 6px;
		margin-left: 4px;
	`,

	reasonIcon: css`
		color: ${token.colorText};
		margin-top: 8px;
		flex-shrink: 0;
	`,

	reasonText: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		text-align: left;
	`,

	statusText: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		text-align: left;
	`,

	actionBox: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 10px;
		padding: 14px;
		background-color: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		width: 100%;
	`,

	actionTitle: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		text-align: left;
		width: 100%;
	`,

	actionContainer: css`
		display: flex;
		flex-direction: column;
		width: 100%;
	`,

	actionItem: css`
		display: flex;
		align-items: flex-start;
	`,

	actionIcon: css`
		color: ${token.colorText};
		margin-top: 8px;
		flex-shrink: 0;
	`,

	actionText: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		text-align: left;
	`,
}))
