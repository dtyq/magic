import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		background-color: ${token.magicColorUsages.white};
		border-radius: 12px;
		width: 100%;
		overflow: hidden;
	`,
	menuItem: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px;
		height: 46px;
		cursor: pointer;
		transition: background-color 0.2s ease;

		&:hover {
			background-color: ${token.magicColorUsages.bg[1]};
		}
	`,
	iconWrapper: css`
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	workspaceIcon: css`
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	memoryIcon: css`
		background: linear-gradient(90deg, #02aab0 0%, #00cdac 100%);
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	shareIcon: css`
		background: linear-gradient(134deg, #fc3 2.44%, #ff7d00 100%);
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	scheduleIcon: css`
		background: linear-gradient(134deg, #93edc7 4.89%, #1cd8d2 81.59%);
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;

		svg {
			color: ${token.magicColorUsages.white} !important;
		}
	`,
	preferenceIcon: css`
		background: linear-gradient(134deg, #f24ab7 2.44%, #f26a4c 100%);
		border: 1px solid ${token.magicColorUsages.border};
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;

		svg {
			color: ${token.magicColorUsages.white} !important;
		}
	`,
	menuTitle: css`
		font-family: "PingFang SC", sans-serif;
		font-size: ${token.magicFontUsages.response.text14px};
		line-height: 20px;
		color: ${token.magicColorUsages.text[1]};
	`,
	badge: css`
		background-color: ${token.magicColorUsages.danger.default};
		border-radius: 1000px;
		min-width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 3px;
		margin-left: 8px;
	`,
	badgeText: css`
		font-family: "Inter", sans-serif;
		font-weight: 700;
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.white};
	`,
	arrow: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 18px;
	`,
	divider: css`
		height: 1px;
		background-color: ${token.magicColorUsages.border};
		width: calc(100% - 28px);
		margin: 0 auto;
	`,
}))
