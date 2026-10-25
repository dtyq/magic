import { act, render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { CanvasDesignMethods, GenerateVideoRequest } from "../../../public/magic-types"
import { MagicProvider, useMagic } from "../MagicProvider"

type MagicContextValue = ReturnType<typeof useMagic>
type EstimateVideoPoints = NonNullable<CanvasDesignMethods["estimateVideoPoints"]>

let latestMagic: MagicContextValue | undefined

const request = {
	model_id: "video-model",
	prompt: "prompt",
} as GenerateVideoRequest

function Probe() {
	latestMagic = useMagic()
	return null
}

function getMagic() {
	if (!latestMagic) throw new Error("Magic context did not render")
	return latestMagic
}

function TestProvider(props: {
	children: ReactNode
	estimateVideoPoints: EstimateVideoPoints
	scope: string
}) {
	return (
		<MagicProvider
			methods={{ estimateVideoPoints: props.estimateVideoPoints } as CanvasDesignMethods}
			videoPointsEstimateCacheScope={props.scope}
		>
			{props.children}
		</MagicProvider>
	)
}

describe("MagicProvider video points estimate cache scope", () => {
	it("keeps cached estimates across estimator function changes within the same scope", async () => {
		const estimateA = vi.fn(async () => ({ points: 3 })) as EstimateVideoPoints
		const estimateB = vi.fn(async () => ({ points: 9 })) as EstimateVideoPoints
		const { rerender } = render(
			<TestProvider estimateVideoPoints={estimateA} scope="scope-a">
				<Probe />
			</TestProvider>,
		)

		await act(async () => {
			await getMagic().getVideoPointsEstimate({
				signature: "signature",
				request,
			})
		})
		rerender(
			<TestProvider estimateVideoPoints={estimateB} scope="scope-a">
				<Probe />
			</TestProvider>,
		)
		await act(async () => {
			await getMagic().getVideoPointsEstimate({
				signature: "signature",
				request,
			})
		})

		expect(estimateA).toHaveBeenCalledTimes(1)
		expect(estimateB).not.toHaveBeenCalled()
	})

	it("clears cached estimates when the business scope changes", async () => {
		const estimateA = vi.fn(async () => ({ points: 3 })) as EstimateVideoPoints
		const estimateB = vi.fn(async () => ({ points: 9 })) as EstimateVideoPoints
		const { rerender } = render(
			<TestProvider estimateVideoPoints={estimateA} scope="scope-a">
				<Probe />
			</TestProvider>,
		)

		await act(async () => {
			await getMagic().getVideoPointsEstimate({
				signature: "signature",
				request,
			})
		})
		rerender(
			<TestProvider estimateVideoPoints={estimateB} scope="scope-b">
				<Probe />
			</TestProvider>,
		)

		await waitFor(() => {
			expect(getMagic().getCachedVideoPointsEstimate("signature")).toBeUndefined()
		})
		await act(async () => {
			await getMagic().getVideoPointsEstimate({
				signature: "signature",
				request,
			})
		})

		expect(estimateA).toHaveBeenCalledTimes(1)
		expect(estimateB).toHaveBeenCalledTimes(1)
	})
})
