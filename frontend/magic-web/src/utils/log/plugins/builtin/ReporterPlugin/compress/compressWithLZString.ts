/**
 * 简单的 LZ-string 风格压缩（基于字典）
 * 适用于重复内容较多的日志数据
 */
export function compressWithLZString(data: string): string {
	if (!data) return data

	const dict: Record<string, number> = {}
	const result: (string | number)[] = []
	let dictSize = 256
	let w = ""

	for (let i = 0; i < data.length; i++) {
		const c = data.charAt(i)
		const wc = w + c

		if (dict[wc]) {
			w = wc
		} else {
			// 输出 w 的编码
			if (w.length === 1) {
				result.push(w)
			} else if (dict[w]) {
				result.push(dict[w])
			}

			// 添加 wc 到字典
			dict[wc] = dictSize++
			w = c
		}
	}

	// 输出最后的 w
	if (w) {
		if (w.length === 1) {
			result.push(w)
		} else if (dict[w]) {
			result.push(dict[w])
		}
	}

	return JSON.stringify(result)
}
