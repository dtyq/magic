import { useEffect, useMemo, useState } from "react"
import { useMagic } from "../../context/MagicContext"
import type { EstimateVideoPointsResponse, GenerateVideoRequest } from "../../types.magic"

interface UseVideoPointsEstimateOptions {
	request: Partial<GenerateVideoRequest> | null
	signature: string | null
	enabled?: boolean
}

interface UseVideoPointsEstimateResult {
	estimate: EstimateVideoPointsResponse | null
	points: number | null
	isLoading: boolean
	error: unknown
}

export function useVideoPointsEstimate(
	options: UseVideoPointsEstimateOptions,
): UseVideoPointsEstimateResult {
	const { request, signature, enabled = true } = options
	const { methods, getCachedVideoPointsEstimate, getVideoPointsEstimate } = useMagic()
	const [estimate, setEstimate] = useState<EstimateVideoPointsResponse | null>(null)
	const [error, setError] = useState<unknown>(null)
	const [isLoading, setIsLoading] = useState(false)

	const canEstimate = useMemo(() => {
		return Boolean(enabled && request?.model_id && signature && methods?.estimateVideoPoints)
	}, [enabled, methods, request?.model_id, signature])

	useEffect(() => {
		if (!canEstimate || !signature || !request?.model_id) {
			setEstimate(null)
			setError(null)
			setIsLoading(false)
			return
		}

		const cachedEstimate = getCachedVideoPointsEstimate(signature)
		if (cachedEstimate) {
			setEstimate(cachedEstimate)
			setError(null)
			setIsLoading(false)
			return
		}

		let cancelled = false
		setError(null)
		setIsLoading(true)

		void getVideoPointsEstimate({
			signature,
			request: request as GenerateVideoRequest,
		})
			.then((nextEstimate) => {
				if (cancelled) return
				setEstimate(nextEstimate)
			})
			.catch((nextError) => {
				if (cancelled) return
				setError(nextError)
			})
			.finally(() => {
				if (cancelled) return
				setIsLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [canEstimate, getCachedVideoPointsEstimate, getVideoPointsEstimate, request, signature])

	return {
		estimate,
		points: typeof estimate?.points === "number" ? estimate.points : null,
		isLoading: canEstimate && isLoading,
		error,
	}
}
