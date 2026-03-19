import { describe, it, expect } from "vitest"
// @ts-ignore
import { calculatePanelSizes } from "../panelSizeCalculator"

describe("calculatePanelSizes", () => {
	describe("getMainMinWidth", () => {
		it("should return correct min width when topic is open", () => {
			expect(calculatePanelSizes.getMainMinWidth(true)).toBe(600)
		})

		it("should return correct min width when topic is closed", () => {
			expect(calculatePanelSizes.getMainMinWidth(false)).toBe(400)
		})
	})

	describe("getTwoPanelSizes", () => {
		it("should calculate two panel sizes correctly", () => {
			const totalWidth = 1200
			const siderWidth = 240
			const result = calculatePanelSizes.getTwoPanelSizes(totalWidth, siderWidth)

			expect(result).toEqual([240, 960])
		})

		it("should handle edge cases", () => {
			const result = calculatePanelSizes.getTwoPanelSizes(500, 300)
			expect(result).toEqual([300, 200])
		})
	})

	describe("getThreePanelSizes", () => {
		it("should calculate three panel sizes with adequate space", () => {
			const totalWidth = 1200
			const siderWidth = 240
			const filePreviewWidth = 300
			const mainMinWidth = 400

			const result = calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				siderWidth,
				filePreviewWidth,
				mainMinWidth,
			)

			expect(result).toEqual([240, 660, 300])
		})

		it("should enforce main panel minimum width", () => {
			const totalWidth = 800
			const siderWidth = 200
			const filePreviewWidth = 500 // 这会导致主面板小于最小宽度
			const mainMinWidth = 400

			const result = calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				siderWidth,
				filePreviewWidth,
				mainMinWidth,
			)

			// 主面板应该保持最小宽度，文件预览面板被压缩
			expect(result).toEqual([200, 400, 200])
		})

		it("should handle minimum space requirements", () => {
			const totalWidth = 700
			const siderWidth = 200
			const filePreviewWidth = 200
			const mainMinWidth = 600 // 超过可用空间

			const result = calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				siderWidth,
				filePreviewWidth,
				mainMinWidth,
			)

			expect(result).toEqual([200, 600, -100]) // 文件预览被压缩为负数，实际应用中需要进一步处理
		})
	})

	describe("getFilePreviewOpenSizes", () => {
		it("should calculate file preview open sizes with correct ratios", () => {
			const totalWidth = 1200
			const siderWidth = 240

			const result = calculatePanelSizes.getFilePreviewOpenSizes(totalWidth, siderWidth)

			// 可用宽度: 1200 - 240 = 960
			// 主面板: 960 * 0.6 = 576
			// 文件预览: 960 * 0.4 = 384
			expect(result).toEqual([240, 576, 384])
		})

		it("should handle small total width", () => {
			const totalWidth = 600
			const siderWidth = 200

			const result = calculatePanelSizes.getFilePreviewOpenSizes(totalWidth, siderWidth)

			// 可用宽度: 600 - 200 = 400
			// 主面板: 400 * 0.6 = 240
			// 文件预览: 400 * 0.4 = 160
			expect(result).toEqual([200, 240, 160])
		})
	})

	describe("handleSiderResize", () => {
		it("should handle two panel resize", () => {
			const prevSizes = [240, 960]
			const newSizes = [300, 900]
			const totalWidth = 1200
			const mainMinWidth = 400

			const result = calculatePanelSizes.handleSiderResize(
				prevSizes,
				newSizes,
				totalWidth,
				mainMinWidth,
			)

			expect(result).toEqual([300, 900])
		})

		it("should handle three panel resize when sider width unchanged", () => {
			const prevSizes = [240, 660, 300]
			const newSizes = [240, 560, 400]
			const totalWidth = 1200
			const mainMinWidth = 400

			const result = calculatePanelSizes.handleSiderResize(
				prevSizes,
				newSizes,
				totalWidth,
				mainMinWidth,
			)

			// 侧边栏宽度未变，应该重新计算主面板和文件预览面板
			expect(result).toEqual([240, 560, 400])
		})

		it("should handle three panel resize when file preview width unchanged", () => {
			const prevSizes = [240, 660, 300]
			const newSizes = [280, 620, 300]
			const totalWidth = 1200
			const mainMinWidth = 400

			const result = calculatePanelSizes.handleSiderResize(
				prevSizes,
				newSizes,
				totalWidth,
				mainMinWidth,
			)

			// 文件预览宽度未变，应该重新计算
			expect(result).toEqual([280, 620, 300])
		})

		it("should handle edge case with insufficient space", () => {
			const prevSizes = [200, 400, 200]
			const newSizes = [400, 200, 200] // 侧边栏变得很宽
			const totalWidth = 800
			const mainMinWidth = 500 // 主面板需要更多空间

			const result = calculatePanelSizes.handleSiderResize(
				prevSizes,
				newSizes,
				totalWidth,
				mainMinWidth,
			)

			// 应该保证主面板最小宽度
			expect(result).toEqual([400, 500, -100])
		})

		it("should return previous sizes for invalid input", () => {
			const prevSizes = [240, 660, 300]
			const newSizes: number[] = [] // 空数组
			const totalWidth = 1200
			const mainMinWidth = 400

			const result = calculatePanelSizes.handleSiderResize(
				prevSizes,
				newSizes,
				totalWidth,
				mainMinWidth,
			)

			expect(result).toEqual(prevSizes)
		})
	})

	describe("integration scenarios", () => {
		it("should handle complete workflow: open file preview -> resize -> close file preview", () => {
			const totalWidth = 1200
			const siderWidth = 240

			// 1. 初始两面板布局
			const initialSizes = calculatePanelSizes.getTwoPanelSizes(totalWidth, siderWidth)
			expect(initialSizes).toEqual([240, 960])

			// 2. 打开文件预览
			let threePanelSizes = calculatePanelSizes.getFilePreviewOpenSizes(
				totalWidth,
				siderWidth,
			)
			expect(threePanelSizes).toEqual([240, 576, 384])

			// 3. 调整侧边栏
			const newSizes = [300, 540, 360]
			threePanelSizes = calculatePanelSizes.handleSiderResize(
				threePanelSizes,
				newSizes,
				totalWidth,
				400,
			) as [number, number, number]
			expect(threePanelSizes).toEqual([300, 540, 360])

			// 4. 关闭文件预览
			const finalSizes = calculatePanelSizes.getTwoPanelSizes(totalWidth, threePanelSizes[0])
			expect(finalSizes).toEqual([300, 900])
		})

		it("should maintain consistency when topic opens and closes", () => {
			const totalWidth = 1200
			const siderWidth = 240
			const filePreviewWidth = 300

			// 话题关闭时的最小宽度
			let minWidth = calculatePanelSizes.getMainMinWidth(false)
			expect(minWidth).toBe(400)

			let sizes = calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				siderWidth,
				filePreviewWidth,
				minWidth,
			)
			expect(sizes).toEqual([240, 660, 300])

			// 话题打开时的最小宽度
			minWidth = calculatePanelSizes.getMainMinWidth(true)
			expect(minWidth).toBe(600)

			sizes = calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				siderWidth,
				filePreviewWidth,
				minWidth,
			)
			expect(sizes).toEqual([240, 660, 300]) // 已经满足最小宽度要求
		})
	})
})
