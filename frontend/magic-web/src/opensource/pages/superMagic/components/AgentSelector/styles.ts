import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		width: 100%;
		display: flex;
		flex-direction: column;
		background: ${token.magicColorUsages.bg[0]};
		padding: 0;
		height: 610px;
		overflow-y: hidden;
		user-select: none;
	`,

	header: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid ${token.colorBorder};
		padding-bottom: 20px;
	`,
	searchWrapper: css`
		display: flex;
		align-items: center;
		gap: 10px;
	`,
	title: css`
		font-size: 16px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	`,

	searchInput: css`
		width: 200px;
		border-radius: 8px;
		font-size: 12px;
		background: ${token.magicColorUsages.fill[0]};
	`,

	content: css`
		flex: 1;
		overflow-y: auto;
		display: flex;
		overflow: hidden;
	`,

	leftPanel: css`
		padding-top: 16px;
		display: flex;
		flex-direction: column;
		min-width: 0;
		width: 313px;
		padding-right: 20px;
	`,

	rightPanel: css`
		padding-top: 20px;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	`,
	closeIcon: css`
		cursor: pointer;
	`,
	sectionHeader: css`
		margin-bottom: 10px;
		flex-shrink: 0;
	`,

	sectionTitle: css`
		font-size: 16px;
		font-weight: 600;
		line-height: 22px;
		color: ${token.magicColorUsages.text[1]};
		margin-bottom: 4px;
	`,

	sectionDescription: css`
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
		color: ${token.magicColorUsages.text[3]};
	`,

	agentGrid: css`
		padding: 1px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow-y: auto;
		height: 100%;

		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
			border-radius: 2px;
		}

		&::-webkit-scrollbar-thumb {
			background: ${token.magicColorUsages.fill[2]};
			border-radius: 2px;
			border: none;
		}

		&::-webkit-scrollbar-thumb:hover {
			background: ${token.magicColorUsages.fill[1]};
		}

		scrollbar-width: thin;
		scrollbar-color: ${token.magicColorUsages.fill[2]} transparent;
	`,
	agentCard: css`
		height: 70px;
		gap: 12px;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 10px;
		background: ${token.colorBgContainer};
		&:hover {
			border-color: ${token.colorPrimary};
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
			transform: translateY(-1px);
		}
	`,

	agentCardContent: css`
		display: flex;
		align-items: center;
		gap: 10px;
	`,

	agentIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 50px;
		height: 50px;
		border-radius: 20px;
		background: ${token.colorPrimary}10;
		color: ${token.colorPrimary};
		font-size: 20px;
		flex-shrink: 0;
		transition: all 0.2s ease;
	`,

	agentName: css`
		flex: 1;
		min-width: 0;
		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[1]};
	`,

	agentActions: css`
		display: flex;
		align-items: center;
		gap: 8px;
	`,

	actionButton: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[2]};
		padding: 4px 8px;
		border: none;
		line-height: 16px;
		&:hover {
			color: ${token.colorPrimary};
			background: ${token.colorPrimary};
		}
	`,

	dragHandle: css`
		cursor: grab;
		color: ${token.magicColorUsages.text[3]};
		font-size: 14px;
		transition: color 0.2s ease;
		width: 20px;
		height: 20px;

		&:hover {
			color: ${token.magicColorUsages.text[2]};
		}

		&:active {
			cursor: grabbing;
		}
	`,

	dropZoneActive: css`
		background: ${token.colorPrimary}08;
		border: 2px dashed ${token.colorPrimary};
		border-radius: 8px;
		transition: all 0.2s ease;
	`,

	agentList: css`
		padding-left: 16px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		overflow-y: auto;
		overflow-x: hidden;
		height: 100%;
		align-content: start;

		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
			border-radius: 2px;
		}

		&::-webkit-scrollbar-thumb {
			background: ${token.magicColorUsages.fill[2]};
			border-radius: 2px;
			border: none;
		}

		&::-webkit-scrollbar-thumb:hover {
			background: ${token.magicColorUsages.fill[1]};
		}

		scrollbar-width: none;
		scrollbar-color: ${token.magicColorUsages.fill[2]} transparent;
	`,
	allAgentList: css`
		display: flex;
		gap: 10px;
	`,
	allAgentListItem: css`
		height: 70px;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 10px 12px;
		background: ${token.colorBgContainer};
		position: relative;
		width: 278px;
		&:hover {
			border: 1px solid ${token.colorPrimary};
			box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
		}
	`,
	agentListItem: css`
		width: 278px;
		height: 70px;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 10px 12px;
		&:hover {
			border: 1px solid ${token.colorPrimary};
			box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
		}
	`,

	agentListContent: css`
		display: flex;
		align-items: center;
		gap: 8px;
		height: 100%;
	`,

	agentListLeft: css`
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	`,
	addAgentIconContainer: css`
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
	`,
	addAgentIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
	`,
	agentListIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 50px;
		height: 50px;
		border-radius: 20px;
		background: ${token.colorPrimary}10;
		color: ${token.colorPrimary};
		font-size: 16px;
		flex-shrink: 0;
		transition: all 0.2s ease;
	`,

	agentListInfo: css`
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	`,

	agentListName: css`
		font-size: 14px;
		line-height: 20px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 108px;
	`,
	addAgentTitle: css`
		font-size: 14px;
		line-height: 20px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
		overflow: hidden;
	`,
	agentListDescription: css`
		font-size: 10px;
		line-height: 13px;
		color: ${token.magicColorUsages.text[2]};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	agentListActions: css`
		display: flex;
		align-items: center;
		gap: 4px;
		opacity: 1;
		transition: all 0.2s ease;
	`,

	agentListDragHandle: css`
		cursor: grab;
		color: ${token.magicColorUsages.text[3]};
		font-size: 14px;
		transition: color 0.2s ease;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			color: ${token.magicColorUsages.text[2]};
		}

		&:active {
			cursor: grabbing;
		}
	`,

	// 分隔符组件样式
	panelDivider: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
	`,

	dividerLine: css`
		width: 1px;
		flex: 1;
		background: ${token.colorBorder};
	`,

	dividerIcon: css`
		width: 50px;
		height: 50px;
		border-radius: 50%;
		background: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		z-index: 10;
		transition: all 0.2s ease;

		&:hover {
			// color: ${token.colorPrimary};
			// border-color: ${token.colorPrimary};
			// background: ${token.colorPrimary}08;
		}
	`,

	// Drop indicator styles
	dropIndicator: css`
		height: 2px;
		background: ${token.colorPrimary};
		border-radius: 1.5px;
		margin-bottom: 10px;
		opacity: 0.8;
		box-shadow: 0 0 8px ${token.colorPrimary}40;
		animation: pulse 1s ease-in-out infinite alternate;
		@keyframes pulse {
			from {
				opacity: 0.6;
			}
			to {
				opacity: 1;
			}
		}
	`,
}))
