import { useEffect, useRef, useState } from "react"

interface LazyImageProps {
	src: string
	alt?: string
	className?: string
	placeholder?: React.ReactNode
	onLoad?: () => void
	onError?: () => void
}

export default function LazyImage({
	src,
	alt = "",
	className,
	placeholder,
	onLoad,
	onError,
}: LazyImageProps) {
	const [isLoaded, setIsLoaded] = useState(false)
	const [isInView, setIsInView] = useState(false)
	const [hasError, setHasError] = useState(false)
	const imgRef = useRef<HTMLImageElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries
				if (entry.isIntersecting) {
					setIsInView(true)
					observer.disconnect()
				}
			},
			{
				// 提前 100px 开始加载
				rootMargin: "100px",
				threshold: 0.1,
			},
		)

		if (containerRef.current) {
			observer.observe(containerRef.current)
		}

		return () => {
			observer.disconnect()
		}
	}, [])

	const handleImageLoad = () => {
		setIsLoaded(true)
		onLoad?.()
	}

	const handleImageError = () => {
		setHasError(true)
		onError?.()
	}

	return (
		<div ref={containerRef}>
			{isInView && !hasError && (
				<img
					ref={imgRef}
					src={src}
					alt={alt}
					className={className}
					onLoad={handleImageLoad}
					onError={handleImageError}
					style={{
						opacity: isLoaded ? 1 : 0,
						transition: "opacity 0.3s ease-in-out",
					}}
				/>
			)}
			{(!isInView || (!isLoaded && !hasError)) && placeholder}
			{hasError && placeholder}
		</div>
	)
}
