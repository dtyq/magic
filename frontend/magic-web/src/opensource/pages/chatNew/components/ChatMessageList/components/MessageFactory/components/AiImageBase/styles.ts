import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css }, { count, ratio }: { count: number; ratio: string }) => {
		// 至少为 1
		const subCount = Math.max(count - 1, 1)

		// 根据比例调整网格项的高宽比，减少白边
		const getOptimalAspectRatio = () => {
			if (!ratio) return 1
			const [w, h] = ratio.split(":").map(Number)
			// 对于极端比例，进行一定的调整以减少白边
			const aspectRatio = w / h
			if (aspectRatio > 2) return 2 // 限制过宽的比例
			if (aspectRatio < 0.5) return 0.5 // 限制过高的比例
			return aspectRatio
		}

		// 最大宽度限制（避免图片过大）
		const maxWidthMap: Record<number, number> = {
			4: 150,
			3: 200,
			2: 300,
			1: 480,
		}

		const maxWidth = maxWidthMap[count] || 150

		const grid_base_col = css`
			grid-template-columns: repeat(${count}, 1fr);
			aspect-ratio: ${getOptimalAspectRatio() * count} / ${count === 1 ? 1 : subCount};

			/* 让网格项自动适配容器 */
			& > * {
				aspect-ratio: ${getOptimalAspectRatio()};
				width: 100%;
				height: 100%;
			}
		`
		const grid_16_9_col = css`
			grid-template-columns: repeat(${subCount}, 1fr);
			aspect-ratio: ${getOptimalAspectRatio() * subCount} / ${count};

			/* 让网格项自动适配容器 */
			& > * {
				aspect-ratio: ${getOptimalAspectRatio()};
				width: 100%;
				height: 100%;
			}
		`
		const grid_16_9_4_item = css`
			grid-row: 4 / 5;
			&:nth-child(1) {
				grid-column: 1 / span 3;
				grid-row: 1 / span 3;
			}
			&:nth-child(2) {
				grid-column: 1 / 2;
			}
			&:nth-child(3) {
				grid-column: 2 / 3;
			}
			&:nth-child(4) {
				grid-column: 3 / 4;
			}
		`

		const grid_16_9_3_item = css`
			grid-row: 3 / 4;
			&:nth-child(1) {
				grid-column: 1 / span 2;
				grid-row: 1 / span 2;
			}
			&:nth-child(2) {
				grid-column: 1 / 2;
			}
			&:nth-child(3) {
				grid-column: 2 / 3;
			}
		`

		const grid_16_9_2_item = css`
			&:nth-child(1) {
				grid-row: 1 / 2;
			}
			&:nth-child(2) {
				grid-row: 2 / 3;
			}
		`

		const gird_base_4_item = css`
			grid-column: 4 / 5;
			&:nth-child(1) {
				grid-column: 1 / span 3;
				grid-row: 1 / span 3;
			}
			&:nth-child(2) {
				grid-row: 1 / 2;
			}
			&:nth-child(3) {
				grid-row: 2 / 3;
			}
			&:nth-child(4) {
				grid-row: 3 / 4;
			}
		`

		const gird_base_2_item = css`
			&:nth-child(1) {
				grid-column: 1 / 2;
			}
			&:nth-child(2) {
				grid-column: 2 / 3;
			}
		`

		const gird_base_3_item = css`
			grid-column: 3 / 4;
			&:nth-child(1) {
				grid-column: 1 / span 2;
				grid-row: 1 / span 2;
			}
			&:nth-child(2) {
				grid-row: 1 / 2;
			}
			&:nth-child(3) {
				grid-row: 2 / 3;
			}
		`

		const girdItemStyle = () => {
			switch (ratio) {
				case "16:9":
					switch (count) {
						case 4:
							return grid_16_9_4_item
						case 3:
							return grid_16_9_3_item
						case 2:
							return grid_16_9_2_item
						default:
							return ""
					}
				default:
					switch (count) {
						case 4:
							return gird_base_4_item
						case 3:
							return gird_base_3_item
						case 2:
							return gird_base_2_item
						default:
							return ""
					}
			}
		}

		return {
			container: css`
				display: grid;
				gap: 10px;
				${ratio === "16:9" ? grid_16_9_col : grid_base_col};
				width: 100%;
				max-width: ${maxWidth * count}px;
				box-sizing: border-box;
				overflow: hidden;

				/* 移动端优化 */
				@media (max-width: 768px) {
					gap: 6px;
				}
			`,
			imageItem: css`
				cursor: pointer;
				border-radius: clamp(4px, 0.5vw, 6px);
				overflow: hidden;
				${girdItemStyle()}

				/* Ensure proper scaling and aspect ratio */
				position: relative;
				width: 100%;
				height: 100%;

				/* 确保图片按比例显示 */
				& img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					object-position: center;
				}

				@media (max-width: 768px) {
					touch-action: manipulation;
					-webkit-touch-callout: none;
					-webkit-user-select: none;
					user-select: none;
				}
			`,
		}
	},
)
