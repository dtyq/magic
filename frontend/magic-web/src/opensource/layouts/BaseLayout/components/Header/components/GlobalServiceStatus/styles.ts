import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		background-color: ${token.magicColorUsages.dangerLight.default};
		border-radius: 8px;
	`,

	statusDot: css`
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: linear-gradient(
			270deg,
			${token.magicColorUsages.danger.default} 0%,
			${token.magicColorUsages.warning.default} 100%
		);
		flex-shrink: 0;
	`,

	statusText: css`
		color: ${token.magicColorUsages.danger.default};
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
		white-space: nowrap;
	`,

	// Network offline styles
	offlineContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		background-color: ${token.magicColorUsages.warningLight.default};
		border-radius: 8px;
		cursor: pointer;
	`,

	offlineIcon: css`
		color: ${token.magicColorUsages.warning.default};
		flex-shrink: 0;
	`,

	offlineText: css`
		color: ${token.magicColorUsages.warning.default};
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
		white-space: nowrap;
	`,

	// Network connecting styles
	connectingContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		background-color: ${token.magicColorUsages.primaryLight.default};
		border-radius: 8px;
	`,

	connectingIcon: css`
		color: ${token.magicColorUsages.primary.default};
		flex-shrink: 0;
		animation: spin 1s linear infinite;

		@keyframes spin {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}
	`,

	connectingText: css`
		color: ${token.magicColorUsages.primary.default};
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
		white-space: nowrap;
	`,
}))
