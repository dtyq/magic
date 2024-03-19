import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	layout: css`
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
	`,
	header: css`
		width: 100%;
		display: flex;
		padding: 10px 20px;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid ${token.magicColorUsages.border};
		backdrop-filter: blur(12px);
		color: ${token.magicColorUsages.text[1]};
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: 22px; /* 137.5% */
	`,
	close: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all linear 0.1s;
		border-radius: 6px;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}

		&:active {
			background-color: ${token.magicColorUsages.fill[1]};
		}
	`,
	body: css`
		width: 100%;
		padding: 10px;
		max-height: 60vh;
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,
	bodyWrapper: css`
		width: 100%;
		height: 40px;
	`,
	bodyTitle: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px; /* 142.857% */
	`,
	bodyMenu: css`
		width: 100%;
		height: 30px;
	`,
	button: css`
		display: flex;
		width: 24px;
		height: 24px;
		justify-content: center;
		align-items: center;
		border-radius: 4px;
		cursor: pointer;
		color: ${token.magicColorUsages.text[1]};

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}

		&:active {
			background-color: ${token.magicColorUsages.fill[1]};
		}
	`,
	toggleCell: css`
		display: flex;
		align-items: center;
		gap: 8px;

		& span {
			line-height: 20px;
			text-align: center;
		}

		& div {
			display: inline-flex;
			width: 20px;
			height: 20px;
			cursor: pointer;
		}
	`,
}))
