import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }, props: { height?: number | string }) => {
	const height = typeof props.height === "number" ? `${props.height}px` : props.height || "100%"

	return {
		container: css`
			height: ${height};
			overflow: auto;
			-webkit-overflow-scrolling: touch; /* iOS 滚动优化 */

			/* 隐藏滚动条但保持可滚动 */
			&::-webkit-scrollbar {
				display: none;
			}
			-ms-overflow-style: none;
			scrollbar-width: none;
			width: 100%;

			/*
			 * PullToRefresh 内部节点默认随内容收缩，导致空态 flex-1 + justify-center 无法垂直居中。
			 * 将高度链补全到 content 层，列表内容不足一屏时也能撑满容器。
			 */
			& .adm-pull-to-refresh {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 100%;
			}

			& .adm-pull-to-refresh-content {
				display: flex;
				flex: 1;
				flex-direction: column;
				min-height: 100%;
			}
		`,
	}
})
