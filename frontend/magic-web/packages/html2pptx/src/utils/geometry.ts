/**
 * 合并多个矩形为一个包围盒
 */
export function unionRects(rects: DOMRect[]): {
	left: number
	top: number
	right: number
	bottom: number
} {
	let left = Infinity
	let top = Infinity
	let right = -Infinity
	let bottom = -Infinity
	for (const r of rects) {
		if (r.width <= 0 || r.height <= 0) continue
		if (r.left < left) left = r.left
		if (r.top < top) top = r.top
		if (r.right > right) right = r.right
		if (r.bottom > bottom) bottom = r.bottom
	}

	if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
		return { left: 0, top: 0, right: 0, bottom: 0 }
	}
	return { left, top, right, bottom }
}
