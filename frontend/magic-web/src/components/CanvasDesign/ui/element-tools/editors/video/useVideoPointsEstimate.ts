import { useEffect, useMemo, useRef, useState } from "react"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import type {
	EstimateVideoPointsResponse,
	GenerateVideoRequest,
} from "../../../../public/magic-types"
import {
	resolveVideoPointsEstimateGate,
	type VideoPointsEstimateBlockedReason,
} from "./points/video-points-estimate.policy"
import {
	collectPendingVideoGenerationRequestResourcePaths,
	collectVideoGenerationRequestResourcePaths,
} from "./points/video-points-estimate.resources"

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
	blockedReason: VideoPointsEstimateBlockedReason | null
}

export function useVideoPointsEstimate(
	options: UseVideoPointsEstimateOptions,
): UseVideoPointsEstimateResult {
	const { request, signature, enabled = true } = options
	const { canvas } = useCanvas()
	const { methods, getCachedVideoPointsEstimate, getVideoPointsEstimate } = useMagic()
	const [estimate, setEstimate] = useState<EstimateVideoPointsResponse | null>(null)
	const [estimateSignature, setEstimateSignature] = useState<string | null>(null)
	const [error, setError] = useState<unknown>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [deferralVersion, setDeferralVersion] = useState(0)
	const resolveResourceReference = methods?.resolveResourceReference
	const requestRef = useRef(request)
	requestRef.current = request
	const getCachedVideoPointsEstimateRef = useRef(getCachedVideoPointsEstimate)
	getCachedVideoPointsEstimateRef.current = getCachedVideoPointsEstimate
	const getVideoPointsEstimateRef = useRef(getVideoPointsEstimate)
	getVideoPointsEstimateRef.current = getVideoPointsEstimate

	const requestResourcePaths = useMemo(() => {
		return collectVideoGenerationRequestResourcePaths(request, resolveResourceReference)
	}, [request, resolveResourceReference])
	const pendingResourcePaths = useMemo(() => {
		const uploadManager = canvas?.canvasFileUploadManager
		if (!request) return []
		if (!uploadManager) return requestResourcePaths

		void deferralVersion
		return collectPendingVideoGenerationRequestResourcePaths(
			request,
			(path) => uploadManager.shouldDeferRemoteResourceLoad(path),
			resolveResourceReference,
		)
	}, [canvas, request, requestResourcePaths, deferralVersion, resolveResourceReference])

	const pendingResourceKey = useMemo(
		() => pendingResourcePaths.join("\0"),
		[pendingResourcePaths],
	)
	const hasPendingResourceDeferrals = pendingResourcePaths.length > 0

	const estimateGate = useMemo(
		() =>
			resolveVideoPointsEstimateGate({
				enabled,
				request,
				signature,
				hasEstimateVideoPoints: Boolean(methods?.estimateVideoPoints),
				hasPendingResourceDeferrals,
			}),
		[enabled, hasPendingResourceDeferrals, methods?.estimateVideoPoints, request, signature],
	)
	const canEstimate = estimateGate.canEstimate

	useEffect(() => {
		if (!canvas || estimateGate.blockedReason !== "pending_resource_deferrals") return

		const uploadManager = canvas.canvasFileUploadManager
		const pendingKeys = new Set(
			pendingResourcePaths
				.map((path) => uploadManager.getRemoteResourceLoadDeferralKey(path))
				.filter((key): key is string => Boolean(key)),
		)
		if (pendingKeys.size === 0) return

		return canvas.eventEmitter.on("resource:remote-load-deferral-released", ({ data }) => {
			if (!pendingKeys.has(data.key)) return
			setDeferralVersion((value) => value + 1)
		})
	}, [canvas, estimateGate.blockedReason, pendingResourceKey, pendingResourcePaths, signature])

	useEffect(() => {
		const latestRequest = requestRef.current

		if (!canEstimate || !signature || !latestRequest?.model_id) {
			setEstimate(null)
			setEstimateSignature(null)
			setError(null)
			setIsLoading(false)
			return
		}

		const cachedEstimate = getCachedVideoPointsEstimateRef.current(signature)
		if (cachedEstimate) {
			setEstimate(cachedEstimate)
			setEstimateSignature(signature)
			setError(null)
			setIsLoading(false)
			return
		}

		// Drop previous mode points immediately so a failed edit estimate cannot keep showing them.
		setEstimate(null)
		setEstimateSignature(null)
		setError(null)
		setIsLoading(true)

		let cancelled = false

		void getVideoPointsEstimateRef
			.current({
				signature,
				request: latestRequest as GenerateVideoRequest,
			})
			.then((nextEstimate) => {
				if (cancelled) return
				setEstimate(nextEstimate)
				setEstimateSignature(signature)
			})
			.catch((nextError) => {
				if (cancelled) return
				setEstimate(null)
				setEstimateSignature(null)
				setError(nextError)
			})
			.finally(() => {
				if (cancelled) return
				setIsLoading(false)
			})

		return () => {
			cancelled = true
		}
		// Only signature/canEstimate should re-trigger network. Method identity churn is ignored via refs.
	}, [canvas?.id, canEstimate, signature])

	const pointsForCurrentSignature =
		estimateSignature === signature && typeof estimate?.points === "number"
			? estimate.points
			: null
	const hasStaleEstimateWhileRequesting =
		canEstimate &&
		Boolean(signature) &&
		estimateSignature !== null &&
		estimateSignature !== signature &&
		typeof estimate?.points === "number"

	return {
		estimate: estimateSignature === signature ? estimate : null,
		points: pointsForCurrentSignature,
		isLoading:
			estimateGate.blockedReason === "pending_resource_deferrals" ||
			(canEstimate && (isLoading || hasStaleEstimateWhileRequesting)),
		error,
		blockedReason: estimateGate.blockedReason,
	}
}
