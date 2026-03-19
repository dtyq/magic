/**
 * 使用浏览器原生 CompressionStream 进行 gzip 压缩
 */
export async function compressWithGzip(data: string): Promise<Uint8Array> {
	const stream = new CompressionStream("gzip")
	const writer = stream.writable.getWriter()
	const reader = stream.readable.getReader()

	// 写入数据
	const encoder = new TextEncoder()
	const chunks: Uint8Array[] = []

	// 启动读取
	const readPromise = (async () => {
		try {
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(value)
			}
		} finally {
			reader.releaseLock()
		}
	})()

	// 写入数据并关闭
	await writer.write(encoder.encode(data))
	await writer.close()

	// 等待读取完成
	await readPromise

	// 合并所有块
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
	const result = new Uint8Array(totalLength)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.length
	}

	return result
}
