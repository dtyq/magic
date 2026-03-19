import { useState, useEffect } from "react"

interface UsePdfStateProps {
	initialScale: number
	file?: string | File | null
}

export function usePdfState({ initialScale, file }: UsePdfStateProps) {
	const [numPages, setNumPages] = useState<number>(0)
	const [pageNumber, setPageNumber] = useState<number>(1)
	const [scale, setScale] = useState<number>(initialScale)
	const [rotation, setRotation] = useState<number>(0)
	const [loading, setLoading] = useState<boolean>(!!file)
	const [error, setError] = useState<string>("")
	const [reloadKey, setReloadKey] = useState<number>(0)
	const [isAutoScaling, setIsAutoScaling] = useState<boolean>(false)
	const [isStabilizing, setIsStabilizing] = useState<boolean>(false)

	// Reset state when file changes
	useEffect(() => {
		if (file) {
			console.log("Starting to load new file:", file)
			setLoading(true)
			setError("")
			setNumPages(0)
			setPageNumber(1)
			setIsAutoScaling(false)
			setIsStabilizing(false)
			setReloadKey((prev) => prev + 1)
		} else {
			setLoading(false)
		}
	}, [file])

	return {
		// State values
		numPages,
		pageNumber,
		scale,
		rotation,
		loading,
		error,
		reloadKey,
		isAutoScaling,
		isStabilizing,

		// State setters
		setNumPages,
		setPageNumber,
		setScale,
		setRotation,
		setLoading,
		setError,
		setReloadKey,
		setIsAutoScaling,
		setIsStabilizing,
	}
}
