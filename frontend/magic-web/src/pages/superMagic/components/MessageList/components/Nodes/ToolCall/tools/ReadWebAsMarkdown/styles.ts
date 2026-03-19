import { createStyles } from "antd-style"

export const useStyle = createStyles(({ css, token }) => {
	return {
		node: css`
			width: 100%;
			height: fit-content;
			overflow: hidden;
			flex: none;
			padding: 5px 0;
		`,
		container: css`
			width: fit-content;
			max-width: 100%;
			border-radius: 8px;
			display: inline-flex;
			align-items: center;
			overflow: hidden;
			box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
			border: 1px solid #e5e5e5;
		`,
		tag: css`
			width: fit-content;
			height: 28px;
			display: inline-flex;
			padding: 6px;
			align-items: center;
			overflow: hidden;
			gap: 6px;
			border-radius: 8px;
			background-color: #fff;
			cursor: pointer;
		`,
		tagDisabled: css`
			cursor: not-allowed;
		`,
		tagIcon: css`
			width: 20px;
			height: 20px;
			flex: none;

			img {
				vertical-align: top;
			}
		`,
		tagLabel: css`
			width: fit-content;
			flex: auto;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			white-space: nowrap; /* 强制文本在一行内显示，不换行 */
			overflow: hidden; /* 超出容器的部分隐藏 */
			text-overflow: ellipsis; /* 超出部分用省略号（...）表示 */
		`,
		button: css`
			width: 28px;
			height: 28px;
			border-radius: ${token.borderRadiusSM}px;
			flex: none;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		buttonIcon: css`
			transition: all linear 0.1s;
		`,
		buttonIconActive: css`
			transform: rotate(180deg);
		`,
		tip: css`
			font-size: 12px;
			line-height: 16px;
			flex-shrink: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			min-width: 0;
			flex: none;
		`,
	}
})
