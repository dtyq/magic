// useObjectURL.ts

import { useState, useEffect } from "react"

/**
 * useObjectUrl - 为File对象生成唯一的objectURL，并自动管理其释放
 * 使用WeakMap<File, { url, count }>做引用计数缓存，确保同一个File多处使用时只创建一次objectURL
 * 所有挂载该hook的组件卸载后，才会真正revokeObjectURL
 */
const fileUrlCache = new WeakMap<File, { url: string; count: number }>()

function useObjectUrl(file: File | null) {
	const [url, setUrl] = useState<string | null>(null)

	useEffect(() => {
		if (!file || !(file instanceof File)) {
			setUrl(null)
			return
		}

		let entry = fileUrlCache.get(file)
		if (!entry) {
			try {
				const objectUrl = URL.createObjectURL(file)
				entry = { url: objectUrl, count: 1 }
				fileUrlCache.set(file, entry)
			} catch (error) {
				console.error("Failed to create object URL:", error)
				setUrl(null)
				return
			}
		} else {
			entry.count++
		}
		setUrl(entry.url)

		return () => {
			if (file) {
				const entry = fileUrlCache.get(file)
				if (entry) {
					entry.count--
					if (entry.count === 0) {
						try {
							URL.revokeObjectURL(entry.url)
						} catch (error) {
							console.error("Failed to revoke object URL:", error)
						}
						fileUrlCache.delete(file)
					}
				}
			}
			setUrl(null)
		}
	}, [file])

	return url
}

export default useObjectUrl
