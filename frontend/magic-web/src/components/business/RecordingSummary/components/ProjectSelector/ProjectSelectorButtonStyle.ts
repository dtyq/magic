import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	projectSelectorButton: css`
		background: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		padding: 0 6px 0 10px;
		height: 32px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: "PingFang SC", sans-serif;
		font-size: 12px;
		line-height: 16px;
		color: rgba(28, 29, 35, 0.8);
		transition: all 0.2s ease-out;
		position: relative;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		&.small {
			height: 24px;
			padding: 0 4px 0 6px;
			font-size: 10px;
			line-height: 14px;
		}

		&:hover {
			background: rgba(28, 29, 35, 0.05);
		}

		&:active {
			transform: scale(0.98);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	`,

	projectSelectorIcon: css`
		flex-shrink: 0;
		color: rgba(28, 29, 35, 0.8);
	`,

	projectSelectorText: css`
		flex-shrink: 1;
		flex-grow: 0;
		min-width: 0;
		max-width: 100%;
		color: rgba(28, 29, 35, 0.8);
		background-color: ${token.magicColorUsages.primaryLight.default};
		border-radius: 4px;
		padding: 2px 4px;
		overflow: hidden;
	`,

	projectName: css`
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	projectSelectorChangeLink: css`
		flex-shrink: 0;
		color: ${token.colorPrimary};
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.2s ease-out;

		&:hover {
			color: ${token.colorPrimaryHover};
		}
	`,
}))
