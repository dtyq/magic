import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	badge: css`
		position: fixed;
		right: 12px;
		bottom: 12px;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 12px 6px 38px;
		height: 26px;
		background: #ffffff;
		border-radius: 1000px;
		box-shadow:
			0px 0px 1px 0px rgba(0, 0, 0, 0.3),
			0px 4px 14px 0px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		transition: all 0.2s;

		&:hover {
			transform: translateY(-2px);
			box-shadow:
				0px 2px 2px 0px rgba(0, 0, 0, 0.1),
				0px 6px 18px 0px rgba(0, 0, 0, 0.15);
		}

		&:active {
			transform: translateY(0);
		}
	`,
	logo: css`
		position: absolute;
		left: -1px;
		top: -8px;
		width: 35px;
		height: 35px;
		border-radius: 50%;
	`,
	textContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		line-height: 16px;
	`,
	prefixText: css`
		color: rgba(28, 29, 35, 0.6);
		font-weight: 400;
	`,
	brandText: css`
		background: linear-gradient(134deg, #3f8fff 5%, #ef2fdf 96%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 600;
	`,
	suffixText: css`
		color: rgba(28, 29, 35, 0.6);
		font-weight: 400;
	`,
}))
