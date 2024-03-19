import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	container: css`
		width: 280px;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
		box-shadow: ${token.boxShadowTertiary};
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
		overflow: hidden;
	`,
	header: css`
		height: 40px;
		padding: 8px;
	`,
	searchContainer: css`
		padding: 8px 8px 4px 8px;
	`,
	search: css`
		background-color: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: ${token.borderRadius}px;
		user-select: none;
		transition: all 0.2s ease-in-out;

		&:hover {
			border-color: ${token.colorPrimary};
		}

		&:focus-within {
			border-color: ${token.colorPrimary};
			box-shadow: 0 0 0 2px ${token.colorPrimary}14;
		}
	`,
	list: css`
		overflow-y: auto;
		overflow-x: hidden;
		max-height: 100%;
		user-select: none;
		width: 100%;
		height: fit-content;
		max-height: 300px;
		background: ${token.colorBgContainer};
		padding: 0 8px;

		.${prefixCls}-list-item {
			padding: 12px 16px;
			border-bottom: 1px solid ${token.colorBorderSecondary};
			transition: background-color 0.2s ease-in-out;
			cursor: pointer;

			&:hover {
				background-color: ${token.colorFillTertiary};
			}

			&:last-child {
				border-bottom: none;
			}
		}

		::-webkit-scrollbar {
			width: 6px;
		}

		::-webkit-scrollbar-track {
			background: ${token.colorFillQuaternary};
			border-radius: 3px;
		}

		::-webkit-scrollbar-thumb {
			background: ${token.colorFillSecondary};
			border-radius: 3px;

			&:hover {
				background: ${token.colorFill};
			}
		}
	`,
	errorText: css`
		color: ${token.colorError};
		font-size: 14px;
		text-align: center;
		padding: 24px;
		line-height: 1.5;
		border-radius: ${token.borderRadius}px;
		background: ${token.colorErrorBg};
		border: 1px solid ${token.colorErrorBorder};
	`,
	emptyText: css`
		color: ${token.colorTextTertiary};
		font-size: 14px;
		text-align: center;
		padding: 24px;
		line-height: 1.5;
		background: ${token.colorFillQuaternary};
		border-radius: ${token.borderRadius}px;
		border: 1px dashed ${token.colorBorderSecondary};
	`,
	noMoreContainer: css`
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	`,
	noMoreText: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[3]};
		opacity: 0.6;
	`,
	assistantItem: css`
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: 40px;
	`,
	assistantAvatar: css`
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive});
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.colorWhite};
		font-weight: 500;
		font-size: 14px;
		flex-shrink: 0;
	`,
	assistantInfo: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	`,
	assistantName: css`
		font-size: 14px;
		font-weight: 500;
		color: ${token.colorText};
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,
	assistantDescription: css`
		font-size: 12px;
		color: ${token.colorTextTertiary};
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,
	loadingWrapper: css`
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16px;
		background: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
	`,
	spinContainer: css`
		position: relative;
		min-height: 200px;
		height: 100%;

		.${prefixCls}-spin-container {
			background: ${token.colorBgContainer};
			border-radius: ${token.borderRadius}px;
		}
	`,
	emptyFallback: css`
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	`,
	emptyFallbackText: css`
		color: ${token.magicColorUsages.text[3]};
		text-align: center;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	agentItem: css`
		width: 100%;
		height: 40px;
		cursor: pointer;
		padding: 0 8px;
		border-radius: 8px;
		position: relative;

		/* Category label styles for first item in each group */
		&[data-is-first-in-category="true"] {
			margin-top: 24px;

			&::before {
				position: absolute;
				top: -20px;
				left: 6px;
				color: ${token.magicColorUsages.text[3]};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
				z-index: 1;
			}
		}

		/* Official agents category */
		&[data-is-office="true"][data-is-first-in-category="true"]::before {
			content: attr(data-label);
		}

		/* Personal agents category */
		&[data-is-office="false"][data-is-first-in-category="true"]::before {
			content: attr(data-label);
		}

		&:hover {
			background-color: ${token.colorFillTertiary};
		}

		/* Active/selected state */
		&[data-selected="true"] {
			background-color: ${token.colorPrimaryBg};
			border: 1px solid ${token.colorPrimary};
		}

		/* Disabled state */
		&[data-disabled="true"] {
			opacity: 0.5;
			cursor: not-allowed;

			&:hover {
				background-color: transparent;
				transform: none;
			}
		}
	`,
	agentName: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
}))
