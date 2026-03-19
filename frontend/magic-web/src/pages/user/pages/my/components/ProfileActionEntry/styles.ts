import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px 8px 75px;
		border-radius: 8px;
		width: 100%;
		position: relative;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;

		&:hover {
			opacity: 0.8;
		}
	`,
	textSection: css`
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
	`,
	title: css`
		font-family: "PingFang SC", sans-serif;
		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[0]};
	`,
	pointIcon: css`
		width: 13.327px;
		height: 13.327px;
		border-radius: 50%;
		background: linear-gradient(
			135deg,
			${token.magicColorScales.yellow[4]} 0%,
			${token.magicColorScales.amber[6]} 100%
		);
		border: 0.67px solid ${token.magicColorUsages.border};
		position: relative;

		&::after {
			content: "积";
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 8px;
			color: ${token.magicColorUsages.white};
			font-weight: bold;
		}
	`,
	amount: css`
		font-family: "D-DIN-PRO", sans-serif;
		font-weight: 800;
		font-size: 22.211px;
		line-height: normal;
		letter-spacing: -0.4442px;
		background: linear-gradient(
			135deg,
			${token.magicColorScales.orange[6]} 0%,
			${token.magicColorScales.orange[5]} 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	`,
	characterImage: css`
		position: absolute;
		bottom: -0.165px;
		left: 0;
		width: 70px;
		height: 70px;
		background-color: ${token.magicColorScales.orange[6]};
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;

		&::after {
			content: "🎁";
		}
	`,
	arrow: css`
		color: ${token.magicColorUsages.text[0]};
		font-size: 24px;
	`,
}))
