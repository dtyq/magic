import { memo, useState } from "react"
import type { ImgHTMLAttributes, ReactNode } from "react"

interface MagicImageProps extends ImgHTMLAttributes<HTMLImageElement> {
	fallback?: ReactNode
}

export default memo(function MagicImage(props: MagicImageProps) {
	const { fallback, ...imgProps } = props

	const [isError, setError] = useState<boolean>(false)

	if (isError || !imgProps.src) {
		return fallback
	}
	return (
		<img
			{...imgProps}
			onError={(event) => {
				setError(true)
				imgProps.onError?.(event)
			}}
		/>
	)
})
