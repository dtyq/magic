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
		`,
	}
})
