import { isValidUrl } from "@/utils/http"
import { useEffect, useMemo, useState } from "react"

type ImageInfo = {
	width: number
	height: number
}

const cache = new Map<string, ImageInfo>()

const useImageSize = (url?: string) => {
	const [size, setSize] = useState({
		width: 0,
		height: 0,
	})

	useEffect(() => {
		if (url && isValidUrl(url)) {
			if (cache.has(url)) {
				setSize(cache.get(url)!)
				return
			}

			const img = new Image()
			img.src = url
			img.onload = () => {
				setSize({
					width: img.width,
					height: img.height,
				})
				cache.set(url, {
					width: img.width,
					height: img.height,
				})
			}
		}
	}, [url])

	return useMemo(() => {
		if (!size) return false
		return size.height > 240 && size.height / size.width > 320 / 180
	}, [size])
}

export default useImageSize
