import { createStyles } from "antd-style"
import { darken } from "polished"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 20px;
		box-sizing: border-box;
		width: 100%;
	`,

	greeting: css`
		display: flex;
		align-items: center;
		gap: 10px;
		color: ${token.magicColorUsages?.text?.[1] || "rgba(28, 29, 35, 0.8)"};
	`,

	greetingIcon: css`
		font-size: 28px;
		line-height: 40px;
		flex-shrink: 0;
		animation: shake 0.5s;

		@keyframes shake {
			0% {
				transform: rotate(-10deg);
			}
			25% {
				transform: rotate(10deg);
			}
			50% {
				transform: rotate(0deg);
			}
			75% {
				transform: rotate(-10deg);
			}
			100% {
				transform: rotate(-10deg);
			}
		}
	`,

	greetingText: css`
		font-size: 20px;
		font-weight: 600;
		line-height: 28px;
		color: ${token.magicColorUsages?.text?.[1] || "rgba(28, 29, 35, 0.8)"};
	`,

	description: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: ${token.magicColorUsages?.text?.[1] || "rgba(28, 29, 35, 0.8)"};
		white-space: pre-wrap;
		min-width: 0;
		width: 100%;
	`,

	card: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
		width: 100%;
		box-sizing: border-box;
		transition: opacity 0.2s ease;

		&:hover {
			opacity: 0.9;
		}

		&:active {
			opacity: 0.8;
		}
	`,

	cardBlue: css`
		background-color: ${token.magicColorScales?.brand?.[0] || "#eef3fd"};
		color: ${token.magicColorUsages?.text?.[0] || "#1c1d23"};

		&:hover {
			background-color: ${darken(0.05, token.magicColorScales?.brand?.[0] || "#eef3fd")};
			opacity: 0.9;
		}
	`,

	cardCyan: css`
		background-color: ${token.magicColorScales?.cyan?.[0] || "#e6fafb"};
		color: ${token.magicColorUsages?.text?.[0] || "#1c1d23"};

		&:hover {
			background-color: ${darken(0.05, token.magicColorScales?.cyan?.[0] || "#e6fafb")};
			opacity: 0.9;
		}
	`,

	cardOrange: css`
		background-color: ${token.magicColorScales?.orange?.[0] || "#fff8eb"};
		color: ${token.magicColorUsages?.text?.[0] || "#1c1d23"};

		&:hover {
			background-color: ${darken(0.05, token.magicColorScales?.orange?.[0] || "#fff8eb")};
			opacity: 0.9;
		}
	`,

	cardIcon: css`
		font-size: 18px;
		line-height: 24px;
		flex-shrink: 0;
		margin-right: 4px;
	`,

	cardText: css`
		flex: 1;
		min-width: 0;

		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: ${token.magicColorUsages?.text?.[0] || "#1c1d23"};
		white-space: pre-wrap;
	`,

	cardArrow: css`
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	`,

	arrowBlue: css`
		color: ${token.magicColorScales?.brand?.[5] || "#2447c8"};
	`,

	arrowCyan: css`
		color: #009eaf;
	`,

	arrowOrange: css`
		color: #db6100;
	`,
}))
