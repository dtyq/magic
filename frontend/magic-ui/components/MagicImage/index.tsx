import type { ImgHTMLAttributes } from "react"
import { memo, useEffect, useState } from "react"

export interface MagicImageProps extends ImgHTMLAttributes<HTMLImageElement> {
	errorSrc?: string
}

const MagicImage = memo(function MagicImage(props: MagicImageProps) {
	const { errorSrc, ...imgProps } = props

	const [src, setSrc] = useState<string>(imgProps.src || "")

	useEffect(() => {
		if (imgProps.src) {
			setSrc(imgProps.src)
		}
	}, [imgProps.src])

	return (
		<img
			{...imgProps}
			src={src || errorSrc}
			onError={(event) => {
				setSrc(errorSrc || "")
				imgProps.onError?.(event)
			}}
		/>
	)
})

export default MagicImage
