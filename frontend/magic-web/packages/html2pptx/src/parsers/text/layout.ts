import { unionRects } from "../../utils/geometry"

export interface VisualLine {
	text: string
	rect: { left: number; right: number; top: number; bottom: number }
}

/**
 * 将一个 DOM Text Node 按视觉行拆分
 *
 * 算法：先用整段 Range 的 getClientRects() 得到总行数 K，
 * 再用二分查找定位每个换行点，最终 O(K·logN) 次 DOM 测量，
 * 替代原来逐字符 O(N) 的方式。
 */
export function splitTextNodeByVisualLines(input: {
	doc: Document
	textNode: Text
}): VisualLine[] {
	const { doc, textNode } = input
	const raw = textNode.textContent ?? ""
	if (!raw) return []

	const len = raw.length

	const fullRange = doc.createRange()
	fullRange.setStart(textNode, 0)
	fullRange.setEnd(textNode, len)
	const fullRects = Array.from(fullRange.getClientRects())

	if (fullRects.length === 0) return []

	if (fullRects.length === 1) {
		const r = fullRects[0]
		return [{
			text: raw,
			rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
		}]
	}

	const lineStarts = findLineBreaks(doc, textNode, len, fullRects.length)
	return buildVisualLines(doc, textNode, raw, lineStarts, len)
}

/**
 * 二分查找每一行的起始字符偏移量
 *
 * 对于第 k 行（k >= 2），找到最小的 endOffset 使得
 * Range(0, endOffset).getClientRects().length >= k，
 * 则 endOffset - 1 就是第 k 行的首字符索引。
 */
function findLineBreaks(
	doc: Document,
	textNode: Text,
	len: number,
	totalLines: number,
): number[] {
	const starts = [0]

	for (let targetLine = 2; targetLine <= totalLines; targetLine++) {
		let lo = starts[starts.length - 1] + 1
		let hi = len

		while (lo < hi) {
			const mid = (lo + hi) >>> 1
			const range = doc.createRange()
			range.setStart(textNode, 0)
			range.setEnd(textNode, mid)
			if (range.getClientRects().length >= targetLine) {
				hi = mid
			} else {
				lo = mid + 1
			}
		}

		const lineStart = lo > 0 ? lo - 1 : lo
		if (lineStart > starts[starts.length - 1]) {
			starts.push(lineStart)
		}
	}

	return starts
}

/**
 * 根据行起始偏移量，为每一行创建 Range 并获取边界矩形
 */
function buildVisualLines(
	doc: Document,
	textNode: Text,
	raw: string,
	lineStarts: number[],
	len: number,
): VisualLine[] {
	const lines: VisualLine[] = []

	for (let i = 0; i < lineStarts.length; i++) {
		const start = lineStarts[i]
		const end = i + 1 < lineStarts.length ? lineStarts[i + 1] : len
		if (start >= end) continue

		const range = doc.createRange()
		range.setStart(textNode, start)
		range.setEnd(textNode, end)
		const rects = Array.from(range.getClientRects())

		if (rects.length === 0) continue

		const union = rects.length === 1
			? { left: rects[0].left, right: rects[0].right, top: rects[0].top, bottom: rects[0].bottom }
			: unionRects(rects)

		lines.push({
			text: raw.slice(start, end),
			rect: {
				left: union.left,
				right: union.right,
				top: union.top,
				bottom: union.bottom,
			},
		})
	}

	return lines.sort((a, b) => a.rect.top - b.rect.top)
}
