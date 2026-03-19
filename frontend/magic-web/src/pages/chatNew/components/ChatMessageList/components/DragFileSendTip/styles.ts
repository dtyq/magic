import { createStyles } from "antd-style"
import { transparentize } from "polished"

export const useStyles = createStyles(({ token, css }) => ({
	dragEnteredTipWrapper: css`
		width: 100%;
		height: 100%;
		position: relative;
		z-index: 10;
		transform: translateZ(0);
		will-change: transform;
	`,
	dragEnteredInnerWrapper: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 20px;
		font-size: 12px;
		color: ${token.magicColorUsages.text[1]};
		backdrop-filter: blur(10px);
		background-color: ${transparentize(0.2, token.magicColorUsages.primaryLight.default)};
		text-align: center;
		z-index: 1;

		&::before {
			content: "";
			position: absolute;
			top: 20px;
			left: 20px;
			right: 20px;
			bottom: 20px;
			border: 2px dashed ${token.magicColorUsages.text[3]};
			border-radius: 8px;
			pointer-events: none;
		}
	`,
	dragEnteredMainTip: css`
		font-size: 20px;
		font-weight: 600;
		line-height: 28px;
		position: relative;
		z-index: 1;
	`,
	dragEnteredTip: css`
		color: ${token.magicColorUsages.text[2]};
		text-align: center;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		position: relative;
		z-index: 1;
	`,
	dragEnteredLoader: css`
		@keyframes spin {
			to {
				transform: rotate(360deg);
			}
		}
		animation: spin 0.8s infinite linear;
		position: relative;
		z-index: 1;
	`,
}))
