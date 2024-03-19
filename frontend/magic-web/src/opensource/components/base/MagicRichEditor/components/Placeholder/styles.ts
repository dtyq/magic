import { createStyles } from "antd-style"

// 创建内联样式
export const useStyles = createStyles(({ css }) => ({
	placeholder: css`
		font-size: 1em;
		line-height: 1.5em;
		padding: 0;
		margin: 0;
		pointer-events: none;
		user-select: none;
		font-family: inherit;
		font-weight: normal;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 95%;
		opacity: 0.8; /* 轻微降低不透明度 */
		letter-spacing: normal;
		transition: opacity 0.2s;

		/* 当编辑器被hover时稍微减淡占位符 */
		&:hover {
			opacity: 0.6;
		}

		/* 打字光标闪烁动画 */
		@keyframes blink {
			0%,
			50% {
				opacity: 1;
			}
			51%,
			100% {
				opacity: 0;
			}
		}
	`,
}))
