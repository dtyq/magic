import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	startButton: css`
		background: none;
		border: none;
		border-radius: 1000px;
		padding: 6px 16px 6px 8px;
		color: white;
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: "PingFang SC", sans-serif;
		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		transition: transform 0.2s ease-out;
		position: relative;
		overflow: hidden;
		cursor: default;

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&:focus-visible {
			outline: 2px solid ${token.colorPrimary};
			outline-offset: 2px;
		}
	`,

	startButtonMobile: css`
		border-radius: 100px;
		background: linear-gradient(97deg, #261f46 29.12%, #241ad6 74.21%, #a517fd 100%);
	`,

	currentItemBg: css`
		position: absolute;
		left: 0;
		top: 0;
		width: 80px;
		height: 100%;
		border-radius: 100px;
		background: linear-gradient(97deg, #261f46 29.12%, #241ad6 74.21%, #a517fd 100%);
		transition:
			width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 1;
		pointer-events: none;

		&:active {
			transform: scale(0.98);
		}
	`,
	startButtonContent: css`
		position: relative;
		z-index: 2;
		transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		height: 30px;
	`,

	activeText: css`
		transform: scale(1);
		color: white;
		transition:
			transform 0.2s ease-out,
			color 0.2s ease-out;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		padding: 8px 12px;
		margin: -8px -12px;
		border-radius: 4px;

		&.disabled {
			transform: none;
			cursor: not-allowed;
		}

		&:active:not(.disabled) {
			transform: scale(0.96);
		}
	`,

	inactiveText: css`
		transform: translateX(-10px) scale(0.9);
		color: rgba(23, 23, 23, 1);
		transition:
			transform 0.2s ease-out,
			color 0.2s ease-out;
		font-weight: 500;
		font-size: 14px;
		white-space: nowrap;
		cursor: default;
		letter-spacing: 0.01em;
		padding: 8px 12px;
		margin: -8px -12px;
		border-radius: 4px;

		&.disabled {
			transform: none;
			cursor: not-allowed;
		}

		&:hover:not(.disabled) {
			color: ${token.magicColorUsages.text[1]};
			transform: scale(0.95);
		}
	`,

	subButtonMobile: css`
		color: ${token.magicColorUsages.text[3]};
		transition:
			transform 0.2s ease-out,
			color 0.2s ease-out;
		font-weight: 500;
		font-size: 14px;
		white-space: nowrap;
		cursor: default;
		letter-spacing: 0.01em;
		padding: 8px 12px;
		margin: -8px -12px;
		border-radius: 4px;

		&.disabled {
			transform: none;
			cursor: not-allowed;
		}
	`,
}))
