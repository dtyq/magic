/**
 * SnapResolver - 吸附计算的单一入口
 *
 * 职责：给定拖拽意图与选区，计算吸附后的目标 rect（始终在 content 空间）
 * 调用方根据场景决定如何应用：
 * - 单选：直接更新节点
 * - 多选：通过 BoxMapper 转为 Konva box，由 boundBoxFunc 返回
 *
 * 消除理解负担：吸附的「计算」与「应用」分离，此处只负责计算
 */
import type { Box } from "konva/lib/shapes/Transformer"
import type { Rect } from "../utils/utils"
import type { LayerElement } from "../types"
import type { AlignmentInfo, AlignmentType } from "./snapGuideTypes"
import { BoxMapper } from "../utils/BoxMapper"
import { constrainRectToAspectRatio } from "./anchorUtils"

export interface SnapResolverContext {
	findAlignments(rect: Rect, targets: LayerElement[], anchor?: string | null): AlignmentInfo[]
	calculateSnapResult(
		alignments: AlignmentInfo[],
		rect: Rect,
	): { snappedAlignments: AlignmentInfo[]; snapOffsetX: number; snapOffsetY: number }
	getAlignmentTargets(selectedIds: string[]): LayerElement[]
	calculateElementsRect(selectedIds: string[]): Rect | null
	ensureCache(): void
	getAllowedAlignments(overrideAnchor?: string | null): Set<AlignmentType>
}

export interface SnapResult {
	snappedRect: Rect
	snappedAlignments: AlignmentInfo[]
	snapOffsetX: number
	snapOffsetY: number
	coordinateSpace: "content"
}

/**
 * 吸附解析器
 */
export class SnapResolver {
	private readonly ctx: SnapResolverContext

	constructor(ctx: SnapResolverContext) {
		this.ctx = ctx
	}

	/**
	 * 在 content 空间计算吸附后的 rect
	 * @returns 若有吸附则返回结果，否则 null
	 */
	resolveInContentSpace(params: {
		draggingRect: Rect
		targets: LayerElement[]
		activeAnchor: string | null
		options?: { keepRatio: boolean; aspectRatio: number }
	}): SnapResult | null {
		const { draggingRect, targets, activeAnchor, options } = params
		this.ctx.ensureCache()

		const alignments = this.ctx.findAlignments(draggingRect, targets, activeAnchor)
		const { snappedAlignments, snapOffsetX, snapOffsetY } = this.ctx.calculateSnapResult(
			alignments,
			draggingRect,
		)

		if (snappedAlignments.length === 0) return null

		let x = draggingRect.x
		let y = draggingRect.y
		let width = draggingRect.width
		let height = draggingRect.height

		const xAlign = snappedAlignments.find((a) => ["left", "center", "right"].includes(a.type))
		const yAlign = snappedAlignments.find((a) => ["top", "middle", "bottom"].includes(a.type))

		if (xAlign) {
			if (xAlign.type === "left") {
				x = draggingRect.x + snapOffsetX
				width = draggingRect.width - snapOffsetX
			} else if (xAlign.type === "right") {
				width = draggingRect.width + snapOffsetX
			} else {
				x = draggingRect.x + snapOffsetX
			}
		}
		if (yAlign) {
			if (yAlign.type === "top") {
				y = draggingRect.y + snapOffsetY
				height = draggingRect.height - snapOffsetY
			} else if (yAlign.type === "bottom") {
				height = draggingRect.height + snapOffsetY
			} else {
				y = draggingRect.y + snapOffsetY
			}
		}

		let snappedRect: Rect = { x, y, width, height }
		if (options?.keepRatio && options.aspectRatio > 0 && activeAnchor) {
			snappedRect = constrainRectToAspectRatio(
				snappedRect,
				draggingRect,
				activeAnchor,
				options.aspectRatio,
			)
		}

		return {
			snappedRect,
			snappedAlignments,
			snapOffsetX,
			snapOffsetY,
			coordinateSpace: "content",
		}
	}

	/**
	 * 多选 anchor 场景：返回 Konva boundBoxFunc 所需的吸附后 box
	 * 内部完成 content ↔ konva 坐标转换
	 */
	getSnappedBox(
		oldBox: Box,
		newBox: Box,
		activeAnchor: string | null,
		selectedIds: string[],
		options?: { keepRatio: boolean; aspectRatio: number },
	): Box {
		if (!activeAnchor || selectedIds.length === 0) return newBox

		const currentRect = this.ctx.calculateElementsRect(selectedIds)
		if (!currentRect) return newBox

		const mapper = new BoxMapper()
		mapper.calibrate(oldBox, currentRect)

		const targetRect = mapper.applyKonvaDeltaToContent(
			currentRect,
			newBox.x - oldBox.x,
			newBox.y - oldBox.y,
			newBox.width - oldBox.width,
			newBox.height - oldBox.height,
		)

		const targets = this.ctx.getAlignmentTargets(selectedIds)
		const result = this.resolveInContentSpace({
			draggingRect: targetRect,
			targets,
			activeAnchor,
			options,
		})

		if (!result) return newBox

		return { ...newBox, ...mapper.contentToKonva(result.snappedRect) }
	}
}
