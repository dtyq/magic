import { createStyles } from "antd-style"
import streamLoadingIcon from "@/assets/resources/stream-loading-2.png"

// 定义光标类名常量
export const CURSOR_CLASS_NAME = "markdown-stream-cursor"
export const CURSOR_CONTAINER_CLASS_NAME = "markdown-stream-cursor-container"

export const useStreamStyles = createStyles(({ css }) => {
	return {
		cursor: css`
			display: inline-block;
			margin-left: 2px;
			width: 16px;
			height: 16px;
			background: url(${streamLoadingIcon});
			background-size: 100%;
			scale: 1.3;
			vertical-align: text-bottom;
			animation: blink 1s step-end infinite;

			@keyframes blink {
				0%,
				100% {
					opacity: 1;
				}
				50% {
					opacity: 0.5;
				}
			}
		`,
	}
})
