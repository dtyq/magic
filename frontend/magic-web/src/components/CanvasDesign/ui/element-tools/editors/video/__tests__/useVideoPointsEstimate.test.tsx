import { act, render, waitFor } from "@testing-library/react"
import { useEffect, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../../runtime/core/Canvas"
import { EventEmitter } from "../../../../../runtime/core/EventEmitter"
import type { CanvasDesignMethods, GenerateVideoRequest } from "../../../../../public/magic-types"
import { CanvasProvider, useCanvas } from "../../../../../app/providers/CanvasProvider"
import { MagicProvider } from "../../../../../app/providers/MagicProvider"
import { useVideoPointsEstimate } from "../useVideoPointsEstimate"

type EstimateVideoPoints = NonNullable<CanvasDesignMethods["estimateVideoPoints"]>
type HookResult = ReturnType<typeof useVideoPointsEstimate>

let latestResult: HookResult | undefined

function getResult() {
	if (!latestResult) throw new Error("Hook did not render")
	return latestResult
}

function createCanvasStub(deferredPaths: Set<string>) {
	const eventEmitter = new EventEmitter()
	const canvas = {
		id: "canvas-1",
		eventEmitter,
		canvasFileUploadManager: {
			shouldDeferRemoteResourceLoad: (path: string) => deferredPaths.has(path),
			getRemoteResourceLoadDeferralKey: (path: string) => path,
		},
	} as unknown as Canvas
	return { canvas, eventEmitter }
}

function CanvasSetter(props: { canvas: Canvas }) {
	const { setCanvas } = useCanvas()

	useEffect(() => {
		setCanvas(props.canvas)
		return () => setCanvas(null)
	}, [props.canvas, setCanvas])

	return null
}

function Probe(props: { request: Partial<GenerateVideoRequest>; signature: string }) {
	latestResult = useVideoPointsEstimate({
		request: props.request,
		signature: props.signature,
	})
	return null
}

function Providers(props: {
	children: ReactNode
	canvas: Canvas
	estimateVideoPoints: EstimateVideoPoints
}) {
	return (
		<CanvasProvider>
			<MagicProvider
				methods={{ estimateVideoPoints: props.estimateVideoPoints } as CanvasDesignMethods}
			>
				<CanvasSetter canvas={props.canvas} />
				{props.children}
			</MagicProvider>
		</CanvasProvider>
	)
}

describe("useVideoPointsEstimate", () => {
	it("does not estimate or show loading without prompt or media intent", async () => {
		const deferredPaths = new Set(["./videos/pending.mp4"])
		const { canvas } = createCanvasStub(deferredPaths)
		const estimateVideoPoints = vi.fn(async () => ({ points: 5 })) as EstimateVideoPoints

		render(
			<Providers canvas={canvas} estimateVideoPoints={estimateVideoPoints}>
				<Probe
					signature="signature"
					request={{
						model_id: "video-model",
						prompt: " ",
					}}
				/>
			</Providers>,
		)

		await waitFor(() => {
			expect(getResult().blockedReason).toBe("missing_user_intent")
		})
		expect(getResult().isLoading).toBe(false)
		expect(estimateVideoPoints).not.toHaveBeenCalled()
	})

	it("estimates media-only requests without requiring prompt text", async () => {
		const deferredPaths = new Set<string>()
		const { canvas } = createCanvasStub(deferredPaths)
		const estimateVideoPoints = vi.fn(async () => ({ points: 6 })) as EstimateVideoPoints

		render(
			<Providers canvas={canvas} estimateVideoPoints={estimateVideoPoints}>
				<Probe
					signature="signature"
					request={{
						model_id: "video-model",
						prompt: " ",
						inputs: {
							reference_videos: [{ uri: "./videos/linked.mp4" }],
						},
					}}
				/>
			</Providers>,
		)

		await waitFor(() => {
			expect(estimateVideoPoints).toHaveBeenCalledTimes(1)
			expect(getResult().points).toBe(6)
		})
	})

	it("estimates after pending media resources are released without requiring prompt text", async () => {
		const deferredPaths = new Set(["./videos/pending.mp4"])
		const { canvas, eventEmitter } = createCanvasStub(deferredPaths)
		const estimateVideoPoints = vi.fn(async () => ({ points: 7 })) as EstimateVideoPoints

		render(
			<Providers canvas={canvas} estimateVideoPoints={estimateVideoPoints}>
				<Probe
					signature="signature"
					request={{
						model_id: "video-model",
						prompt: " ",
						inputs: {
							reference_videos: [{ uri: "./videos/pending.mp4" }],
						},
					}}
				/>
			</Providers>,
		)

		await waitFor(() => {
			expect(getResult().blockedReason).toBe("pending_resource_deferrals")
		})
		expect(getResult().isLoading).toBe(true)
		expect(estimateVideoPoints).not.toHaveBeenCalled()

		await act(async () => {
			deferredPaths.clear()
			eventEmitter.emit({
				type: "resource:remote-load-deferral-released",
				data: { key: "./videos/pending.mp4" },
			})
		})

		await waitFor(() => {
			expect(estimateVideoPoints).toHaveBeenCalledTimes(1)
			expect(getResult().points).toBe(7)
		})
	})
})
