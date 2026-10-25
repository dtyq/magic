import { act, render, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HTML_PERMISSION_GRANTS_CHANGED_EVENT } from "../../iframe-api/services/HtmlPermissionGrantStore"
import {
	IframePermissionService,
	type HtmlPermissionSnapshot,
} from "../../iframe-api/services/IframePermissionService"
import { shouldShowHtmlPermissionManager, useHtmlAppPermissions } from "../useHtmlAppPermissions"

const mocks = vi.hoisted(() => ({
	getIframeDownloadUrl: vi.fn(),
	modalConfirm: vi.fn(),
	grantStore: {
		getAppGrants: vi.fn(),
		prune: vi.fn(),
	},
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: mocks.modalConfirm },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { warning: vi.fn() },
}))

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({ children }: { children: React.ReactNode }) => children,
	SelectContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div data-slot="select-content" className={`z-select ${className || ""}`}>
			{children}
		</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => children,
	SelectTrigger: ({ children }: { children: React.ReactNode }) => children,
	SelectValue: () => null,
}))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: null } },
}))

vi.mock("../../iframe-api/iframeApi", () => ({
	getIframeDownloadUrl: mocks.getIframeDownloadUrl,
}))

vi.mock("../../iframe-api/services/IndexedDbHtmlPermissionGrantStore", () => ({
	getHtmlPermissionGrantStore: () => mocks.grantStore,
}))

describe("useHtmlAppPermissions", () => {
	let originalFetch: typeof globalThis.fetch

	beforeEach(() => {
		originalFetch = globalThis.fetch
		localStorage.clear()
		sessionStorage.clear()
		mocks.getIframeDownloadUrl.mockReset()
		mocks.getIframeDownloadUrl.mockResolvedValue([
			{ url: "https://files.example.com/app.json" },
		])
		mocks.grantStore.getAppGrants.mockReset()
		mocks.grantStore.getAppGrants.mockResolvedValue([])
		mocks.grantStore.prune.mockReset()
		mocks.grantStore.prune.mockResolvedValue(undefined)
		mocks.modalConfirm.mockReset()
		mocks.modalConfirm.mockReturnValue({ destroy: vi.fn() })
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ type: "micro-app", name: "Test App" }),
		}) as unknown as typeof globalThis.fetch
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		vi.restoreAllMocks()
	})

	it("shows permission management only for declared permissions or active grants", () => {
		expect(shouldShowHtmlPermissionManager(false, 0)).toBe(false)
		expect(shouldShowHtmlPermissionManager(true, 0)).toBe(true)
		expect(shouldShowHtmlPermissionManager(false, 1)).toBe(true)
	})

	it("uses the application select layer in the authorization modal", async () => {
		const { result } = renderHook(() =>
			useHtmlAppPermissions({
				content: "<html></html>",
				relativeFilePath: "app/index.html",
				projectId: "project-1",
				fileList: [],
			}),
		)

		void result.current.authorizeHtmlPermission("llm.use")

		await waitFor(() => expect(mocks.modalConfirm).toHaveBeenCalledOnce())
		const modalContent = mocks.modalConfirm.mock.calls[0][0].content
		const { container } = render(modalContent)
		const selectContent = container.querySelector('[data-slot="select-content"]')

		expect(selectContent).toHaveClass("z-select")
		expect(selectContent).toHaveClass("!z-[calc(var(--z-index-modal)+100)]")
		expect(selectContent).not.toHaveClass("!z-[950]")
	})

	it("keeps loaded app config when an unrelated file changes", async () => {
		const appConfigFile = {
			file_id: "app-config",
			relative_file_path: "app/app.json",
			updated_at: "2026-08-05 10:00:00",
		}
		const initialDataFile = {
			file_id: "data-file",
			relative_file_path: "app/data.json",
			updated_at: "2026-08-05 10:00:00",
		}
		const { result, rerender } = renderHook(
			({ fileList }) =>
				useHtmlAppPermissions({
					content: "<html></html>",
					relativeFilePath: "app/index.html",
					projectId: "project-1",
					fileList,
				}),
			{
				initialProps: { fileList: [appConfigFile, initialDataFile] },
			},
		)

		await waitFor(() => {
			expect(result.current.htmlAppConfigState.status).toBe("loaded")
		})

		mocks.getIframeDownloadUrl.mockReturnValueOnce(new Promise(() => undefined))
		rerender({
			fileList: [
				appConfigFile,
				{
					...initialDataFile,
					updated_at: "2026-08-05 10:01:00",
				},
			],
		})

		expect(result.current.htmlAppConfigState.status).toBe("loaded")
		expect(mocks.getIframeDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("keys grants on the entry file id so edits to any file keep the identity", async () => {
		const initialFileList = [
			{
				file_id: "entry-file",
				relative_file_path: "app/index.html",
				updated_at: "2026-08-05 10:00:00",
			},
			{
				file_id: "script-file",
				relative_file_path: "app/runtime.js",
				updated_at: "2026-08-05 10:00:00",
			},
			{
				file_id: "data-file",
				relative_file_path: "app/data.json",
				updated_at: "2026-08-05 10:00:00",
			},
		]
		const { rerender } = renderHook(
			({ fileList }) =>
				useHtmlAppPermissions({
					content: "<html></html>",
					relativeFilePath: "app/index.html",
					projectId: "project-1",
					fileList,
				}),
			{ initialProps: { fileList: initialFileList } },
		)

		await waitFor(() => expect(mocks.grantStore.getAppGrants).toHaveBeenCalled())
		const initialIdentity = mocks.grantStore.getAppGrants.mock.calls.at(-1)?.[0]
		expect(initialIdentity).toMatchObject({ entryFileId: "entry-file", appFingerprint: "" })
		mocks.grantStore.getAppGrants.mockClear()

		rerender({
			fileList: initialFileList.map((file) =>
				file.file_id === "data-file"
					? { ...file, updated_at: "2026-08-05 10:01:00" }
					: file,
			),
		})

		await waitFor(() => expect(mocks.grantStore.getAppGrants).toHaveBeenCalled())
		expect(mocks.grantStore.getAppGrants.mock.calls.at(-1)?.[0]).toEqual(initialIdentity)

		mocks.grantStore.getAppGrants.mockClear()
		rerender({
			fileList: initialFileList.map((file) =>
				file.file_id === "script-file"
					? { ...file, updated_at: "2026-08-05 10:01:00" }
					: file,
			),
		})

		await waitFor(() => expect(mocks.grantStore.getAppGrants).toHaveBeenCalled())
		// Editing an executable sibling must not change the identity grants are keyed on.
		expect(mocks.grantStore.getAppGrants.mock.calls.at(-1)?.[0]).toEqual(initialIdentity)
	})

	it("does not expose manageable grants for legacy apps without saved authorization", async () => {
		const { result } = renderHook(() =>
			useHtmlAppPermissions({
				content: "<html></html>",
				relativeFilePath: "app/index.html",
				projectId: "project-1",
				fileList: [],
			}),
		)

		expect(result.current.isLegacyHtmlPermissionMode).toBe(true)
		await waitFor(() => {
			expect(result.current.activeHtmlPermissionGrantCount).toBe(0)
		})
	})

	it("refreshes active grants and does not reuse the previous app count", async () => {
		const createSnapshot = (activeGrantCount: number): HtmlPermissionSnapshot => ({
			configStatus: "absent",
			mode: "legacy",
			app: {
				name: "",
				version: "",
				entry: "",
				appRootDir: "app/",
				reason: "",
			},
			permissions: [],
			diagnostics: [],
			activeGrantCount,
		})
		let resolveNextAppSnapshot: ((snapshot: HtmlPermissionSnapshot) => void) | undefined
		const getPermissionSnapshot = vi
			.spyOn(IframePermissionService.prototype, "getPermissionSnapshot")
			.mockResolvedValueOnce(createSnapshot(1))
			.mockResolvedValueOnce(createSnapshot(0))
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveNextAppSnapshot = resolve
					}),
			)
		const fileList: [] = []

		const { result, rerender } = renderHook(
			({ relativeFilePath }) =>
				useHtmlAppPermissions({
					content: "<html></html>",
					relativeFilePath,
					projectId: "project-1",
					fileList,
				}),
			{ initialProps: { relativeFilePath: "app/index.html" } },
		)

		await waitFor(() => {
			expect(result.current.activeHtmlPermissionGrantCount).toBe(1)
		})

		act(() => {
			window.dispatchEvent(new Event(HTML_PERMISSION_GRANTS_CHANGED_EVENT))
		})
		await waitFor(() => {
			expect(result.current.activeHtmlPermissionGrantCount).toBe(0)
		})

		rerender({ relativeFilePath: "other/index.html" })
		expect(result.current.activeHtmlPermissionGrantCount).toBe(0)

		resolveNextAppSnapshot?.(createSnapshot(1))
		await waitFor(() => {
			expect(result.current.activeHtmlPermissionGrantCount).toBe(1)
		})
		expect(getPermissionSnapshot).toHaveBeenCalledTimes(3)
	})

	it("reloads app config when app.json changes", async () => {
		const appConfigFile = {
			file_id: "app-config",
			relative_file_path: "app/app.json",
			updated_at: "2026-08-05 10:00:00",
		}
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ type: "micro-app", name: "Initial App" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ type: "micro-app", name: "Updated App" }),
			})
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
		const { result, rerender } = renderHook(
			({ fileList }) =>
				useHtmlAppPermissions({
					content: "<html></html>",
					relativeFilePath: "app/index.html",
					projectId: "project-1",
					fileList,
				}),
			{
				initialProps: { fileList: [appConfigFile] },
			},
		)

		await waitFor(() => {
			expect(result.current.htmlAppConfig?.name).toBe("Initial App")
		})

		rerender({
			fileList: [
				{
					...appConfigFile,
					updated_at: "2026-08-05 10:01:00",
				},
			],
		})

		await waitFor(() => {
			expect(result.current.htmlAppConfig?.name).toBe("Updated App")
		})
		expect(mocks.getIframeDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("refreshes the permission revision when the current tab changes local grants", async () => {
		const { result } = renderHook(() =>
			useHtmlAppPermissions({
				content: "<html></html>",
				relativeFilePath: "app/index.html",
				projectId: "project-1",
				fileList: [],
			}),
		)
		const initialRevision = result.current.permissionRevision

		act(() => {
			window.dispatchEvent(new Event(HTML_PERMISSION_GRANTS_CHANGED_EVENT))
		})

		await waitFor(() => {
			expect(result.current.permissionRevision).not.toBe(initialRevision)
		})
	})

	it("refreshes the permission revision when the current tab clears local grants", async () => {
		const { result } = renderHook(() =>
			useHtmlAppPermissions({
				content: "<html></html>",
				relativeFilePath: "app/index.html",
				projectId: "project-1",
				fileList: [],
			}),
		)
		const initialRevision = result.current.permissionRevision

		act(() => {
			window.dispatchEvent(new Event(HTML_PERMISSION_GRANTS_CHANGED_EVENT))
		})

		await waitFor(() => {
			expect(result.current.permissionRevision).not.toBe(initialRevision)
		})
	})
})
