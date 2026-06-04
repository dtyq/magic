import { createStyles } from "antd-style"

interface MagicPullToRefreshStyleProps {
	height?: number | string
	embedInParentScroll?: boolean
}

export const useStyles = createStyles(({ css }, props: MagicPullToRefreshStyleProps) => {
	if (props.embedInParentScroll) {
		return {
			// Parent scroll container (e.g. ScrollEdgeFade) must be the only overflow:auto node.
			container: css`
				width: 100%;
				min-height: 0;
				overflow: visible;
			`,
		}
	}

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
