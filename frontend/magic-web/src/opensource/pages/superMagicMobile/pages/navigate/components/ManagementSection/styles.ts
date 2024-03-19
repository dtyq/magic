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
	archiveIcon: css`
		background: linear-gradient(90deg, #ff4b1f 0%, #ff9068 100%);
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	shareIcon: css`
		background: linear-gradient(127deg, #00d2ff 21.5%, #3a7bd5 126.4%);
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
