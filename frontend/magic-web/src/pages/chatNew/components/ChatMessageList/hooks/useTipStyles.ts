import { createStyles } from "antd-style"

export const useTipStyles = createStyles(({ css, token }) => ({
	container: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;

		width: 100%;
		text-align: center;
		margin: 6px 0;
		user-select: none;

		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0 10%;
		flex-wrap: wrap;
	`,
	highlight: css`
		color: ${token.colorPrimary};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		text-align: justify;
		cursor: pointer;
	`,
}))
