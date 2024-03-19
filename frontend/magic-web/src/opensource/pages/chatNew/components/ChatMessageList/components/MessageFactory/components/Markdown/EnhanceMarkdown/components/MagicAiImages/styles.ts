import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css }, { count, ratio }: { count: number; ratio: string }) => {
		// 至少为 1
		const subCount = Math.max(count - 1, 1)

		const calculateAspectRatio = (useHeight = false) => {
			if (!ratio) return 1 // 默认正方形
			const [w, h] = ratio.split(":").map(Number)
			return useHeight ? w / h : h / w
		}

		const maxWidthMap: Record<number, number> = {
			4: 150,
			3: 200,
			2: 300,
			1: 480,
		}

		// 使用高度计算的图片比例，默认其他比例使用宽度计算
		const useHeightRatio = ["2:3", "9:16"]
		const isHeightBased = useHeightRatio.includes(ratio)

		const maxWidth = maxWidthMap[count] || 150

		const grid_base_col = css`
			grid-template-columns: repeat(
				${count},
				${isHeightBased
					? `minmax(
					calc(50px * ${calculateAspectRatio(isHeightBased)}),
					calc(${maxWidth}px * ${calculateAspectRatio(isHeightBased)})
				)`
					: `minmax(50px, ${maxWidth}px)`}
			);
			grid-template-rows: repeat(
				${subCount},
				${isHeightBased
					? `minmax(50px, ${maxWidth}px)`
					: `minmax(
					calc(50px * ${calculateAspectRatio(isHeightBased)}),
					calc(${maxWidth}px * ${calculateAspectRatio(isHeightBased)})
				)`}
			);
		`
		const grid_16_9_col = css`
			grid-template-columns: repeat(${subCount}, minmax(50px, ${maxWidth}px));
			grid-template-rows: repeat(
				${count},
				minmax(
					calc(50px * ${calculateAspectRatio()}),
					calc(${maxWidth}px * ${calculateAspectRatio()})
				)
			);
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
			`,
			imageItem: css`
				cursor: pointer;
				border-radius: 6px;
				overflow: hidden;
				${girdItemStyle()}
			`,
		}
	},
)
