import { renderHook, act } from "@testing-library/react"
import { SuperMagicApi } from "@/apis"
import { useMicroAppVisit } from "../useMicroAppVisit"

vi.mock("@/apis", () => ({ SuperMagicApi: { recordMicroAppVisit: vi.fn() } }))

describe("useMicroAppVisit", () => {
	beforeEach(() => vi.clearAllMocks())
	it("records each app once and records a new app after appId changes", () => {
		const record = vi.mocked(SuperMagicApi.recordMicroAppVisit).mockResolvedValue(undefined)
		const { result, rerender } = renderHook(({ appId }) => useMicroAppVisit(appId), {
			initialProps: { appId: "1" },
		})
		act(() => result.current())
		rerender({ appId: "2" })
		act(() => result.current())
		expect(record).toHaveBeenNthCalledWith(1, "1")
		expect(record).toHaveBeenNthCalledWith(2, "2")
	})

	it("allows retry after a failed request", async () => {
		const record = vi
			.mocked(SuperMagicApi.recordMicroAppVisit)
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce(undefined)
		const { result } = renderHook(() => useMicroAppVisit("1"))
		await act(async () => result.current())
		await act(async () => result.current())
		expect(record).toHaveBeenCalledTimes(2)
	})
})
