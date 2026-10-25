import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import { useMicroAppListItemActions } from "../useMicroAppListItemActions"

const mocks = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: mocks.success,
		error: mocks.error,
	},
}))

const app: MicroAppListItem = {
	app_id: "100000000000009003",
	app_name: "客户跟进助手",
	app_description: "",
	creator_id: "user-1",
	cover_url: "",
	publish_status: "unpublished",
	updated_at: null,
	user_role: "owner",
}

describe("useMicroAppListItemActions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		window.history.replaceState({}, "", "/cluster-a/super/micro-apps/list")
	})

	it("opens the published app route in a new window", () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
		const { result } = renderHook(() =>
			useMicroAppListItemActions({ renameApp: vi.fn(), deleteApp: vi.fn() }),
		)

		act(() => result.current.openInNewWindow(app))

		expect(openSpy).toHaveBeenCalledWith(
			"/micro-app/100000000000009003",
			"_blank",
			"noopener,noreferrer",
		)
		openSpy.mockRestore()
	})

	it("renames and deletes by app_id, then closes the dialogs", async () => {
		const renameApp = vi.fn().mockResolvedValue({})
		const deleteApp = vi.fn().mockResolvedValue({})
		const { result } = renderHook(() => useMicroAppListItemActions({ renameApp, deleteApp }))

		act(() => result.current.openRename(app))
		await act(async () => result.current.confirmRename("新名称"))
		expect(renameApp).toHaveBeenCalledWith(app.app_id, "新名称")
		await waitFor(() => expect(result.current.renameTarget).toBeNull())

		act(() => result.current.openDelete(app))
		await act(async () => result.current.confirmDelete())
		expect(deleteApp).toHaveBeenCalledWith(app.app_id)
		await waitFor(() => expect(result.current.deleteTarget).toBeNull())
	})

	it("does not open rename for an app without an edit role", () => {
		const { result } = renderHook(() =>
			useMicroAppListItemActions({ renameApp: vi.fn(), deleteApp: vi.fn() }),
		)

		act(() => result.current.openRename({ ...app, user_role: undefined }))

		expect(result.current.renameTarget).toBeNull()
	})
})
