/** Convert CSS [top, right, bottom, left] points to PptxGenJS text-margin order. */
export function toPptxTextMargin(
	margin: [number, number, number, number],
): [number, number, number, number] {
	const [top, right, bottom, left] = margin
	return [left, right, bottom, top]
}
