import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		fileTree: css`
			display: flex;
			flex-direction: column;
			height: 100%;
		`,

		treeContainer: css`
			flex: auto;
			overflow-x: hidden;
			overflow-y: auto;
		`,

		treeContent: css`
			display: flex;
			flex-direction: column;
			gap: 2px;
		`,

		treeNode: css`
			display: flex;
			align-items: center;
			min-height: 32px;
			gap: 4px;
			border-radius: 6px;
			padding: 4px 8px;
			cursor: pointer;
			transition: background-color 0.2s ease;

			&:hover {
				background-color: ${token.colorFillQuaternary};
			}

			&.selected {
				background-color: ${token.colorPrimaryBg};
				color: ${token.colorPrimary};
			}
		`,

		expandIcon: css`
			width: 20px;
			height: 20px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex: none;
			cursor: pointer;
			border-radius: 4px;
			transition: all 0.2s ease;

			&:hover {
				background-color: ${token.colorFillTertiary};
			}

			&.expanded {
				transform: rotate(90deg);
			}

			&.disabled {
				opacity: 0.3;
				cursor: default;

				&:hover {
					background-color: transparent;
				}
			}
		`,

		nodeIcon: css`
			flex: none;
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		nodeContent: css`
			flex: auto;
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
		`,

		nodeName: css`
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			color: ${token.colorText};
			flex: auto;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		childrenContainer: css`
			transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			overflow: hidden;
			will-change: height;
		`,

		childrenContent: css`
			position: relative;
		`,

		emptyState: css`
			flex: auto;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.colorTextQuaternary};
			font-size: 14px;
			padding: 24px;
		`,
	}
})

// 导出样式工具函数
export const getIndentStyle = (level: number, indent: number = 20) => ({
	paddingLeft: `${level * indent + 4}px`,
})
