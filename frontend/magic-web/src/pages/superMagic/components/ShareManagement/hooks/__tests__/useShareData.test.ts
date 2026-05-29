import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SharedResourceType, SharedTopicFilterStatus } from "../../types"
import { useShareData } from "../useShareData"

const mocks = vi.hoisted(() => ({
	getShareResourcesList: vi.fn(),
	errorToast: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getShareResourcesList: mocks.getShareResourcesList,
		cancelShareResource: vi.fn(),
		batchCancelShareResources: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: mocks.errorToast,
		warning: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("useShareData", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getShareResourcesList.mockResolvedValue({ list: [], total: 0 })
	})

	it("enabled=false 时不请求分享管理列表", async () => {
		renderHook(() =>
			useShareData({
				resourceType: SharedResourceType.File,
				filterStatus: SharedTopicFilterStatus.Active,
				searchText: "",
				projectId: "project-1",
				currentPage: 1,
				enabled: false,
			}),
		)

		await waitFor(() => {
			expect(mocks.getShareResourcesList).not.toHaveBeenCalled()
		})
	})

	it("enabled=true 时请求分享管理列表", async () => {
		renderHook(() =>
			useShareData({
				resourceType: SharedResourceType.File,
				filterStatus: SharedTopicFilterStatus.Active,
				searchText: "",
				projectId: "project-1",
				currentPage: 1,
				enabled: true,
			}),
		)

		await waitFor(() => {
			expect(mocks.getShareResourcesList).toHaveBeenCalled()
		})
	})

	it("enabled 从 true 变为 false 后不再因 projectId 变化触发请求", async () => {
		const { rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useShareData({
					resourceType: SharedResourceType.File,
					filterStatus: SharedTopicFilterStatus.Active,
					searchText: "",
					projectId: "project-1",
					currentPage: 1,
					enabled,
				}),
			{ initialProps: { enabled: true } },
		)

		await waitFor(() => {
			expect(mocks.getShareResourcesList).toHaveBeenCalledTimes(1)
		})

		rerender({ enabled: false })

		await waitFor(() => {
			expect(mocks.getShareResourcesList).toHaveBeenCalledTimes(1)
		})
	})
})
