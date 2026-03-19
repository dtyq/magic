import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
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
	formItem: css`
		margin-bottom: 10px;

		&:last-child {
			margin-bottom: 0;
		}

		& .${prefixCls}-form-item-label {
			padding-bottom: 6px !important;

			& label {
				color: ${token.magicColorUsages.text[2]};
				font-size: 12px;
				font-style: normal;
				font-weight: 400;
				line-height: 16px; /* 133.333% */
			}
		}
	`,
	body: css`
		width: 100%;
		padding: 10px;
		max-height: 60vh;
	`,
	footer: css`
		padding: 10px;
	`,
}))
