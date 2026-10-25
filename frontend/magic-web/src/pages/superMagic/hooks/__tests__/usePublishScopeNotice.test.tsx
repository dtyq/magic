import { act, render, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePublishScopeNotice } from "../usePublishScopeNotice"

const waitForRefreshMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
const noticeDialogPropsMock = vi.hoisted(() => vi.fn())

vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	waitForNextAttachmentsRefreshForProject: waitForRefreshMock,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: toastErrorMock },
}))

vi.mock("@/pages/superMagic/components/PublishScopeNoticeDialog", () => ({
	default: (props: unknown) => {
		noticeDialogPropsMock(props)
		return null
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("usePublishScopeNotice", () => {
	beforeEach(() => {
		waitForRefreshMock.mockReset()
		toastErrorMock.mockReset()
		noticeDialogPropsMock.mockReset()
	})

	it("does not continue when attachment refresh fails", async () => {
		let resolveRefresh: ((didLoad: boolean) => void) | undefined
		waitForRefreshMock.mockImplementation(
			() =>
				new Promise<boolean>((resolve) => {
					resolveRefresh = resolve
				}),
		)
		const status = { isLoaded: false, hasError: false }
		const continueAction = vi.fn()
		const { result } = renderHook(() =>
			usePublishScopeNotice({
				projectId: "project-1",
				getAttachmentsStatus: () => status,
				getAttachments: () => [],
				publishPath: ".magic",
			}),
		)

		let checkPromise: Promise<void> | undefined
		act(() => {
			checkPromise = result.current.checkBeforeContinue(continueAction)
		})
		resolveRefresh?.(false)
		await act(async () => {
			await checkPromise
		})

		expect(continueAction).not.toHaveBeenCalled()
		expect(toastErrorMock).toHaveBeenCalledWith("publishScopeNotice.attachmentsLoadFailed")
	})

	it("checks attachments after a successful refresh", async () => {
		let resolveRefresh: ((didLoad: boolean) => void) | undefined
		waitForRefreshMock.mockImplementation(
			() =>
				new Promise<boolean>((resolve) => {
					resolveRefresh = resolve
				}),
		)
		const status = { isLoaded: false, hasError: false }
		const continueAction = vi.fn()
		const { result } = renderHook(() =>
			usePublishScopeNotice({
				projectId: "project-1",
				getAttachmentsStatus: () => status,
				getAttachments: () => [],
				publishPath: ".magic",
			}),
		)

		let checkPromise: Promise<void> | undefined
		act(() => {
			checkPromise = result.current.checkBeforeContinue(continueAction)
		})
		status.isLoaded = true
		resolveRefresh?.(true)
		await act(async () => {
			await checkPromise
		})

		expect(continueAction).toHaveBeenCalledTimes(1)
		expect(toastErrorMock).not.toHaveBeenCalled()
	})

	it("checks files against the configured publish path", async () => {
		const continueAction = vi.fn()
		const { result } = renderHook(() =>
			usePublishScopeNotice({
				projectId: undefined,
				getAttachmentsStatus: () => ({ isLoaded: true, hasError: false }),
				getAttachments: () =>
					[
						{ relative_file_path: ".magic/skills/demo/SKILL.md" },
						{ relative_file_path: "README.md" },
					] as never,
				publishPath: ".magic/skills/demo",
			}),
		)

		await act(async () => {
			await result.current.checkBeforeContinue(continueAction)
		})

		expect(continueAction).not.toHaveBeenCalled()
	})

	it("shows the latest modified outside files first", async () => {
		const continueAction = vi.fn()
		const { result } = renderHook(() =>
			usePublishScopeNotice({
				projectId: undefined,
				getAttachmentsStatus: () => ({ isLoaded: true, hasError: false }),
				getAttachments: () =>
					[
						{ relative_file_path: "unknown.md" },
						{
							relative_file_path: "older.md",
							updated_at: "2026-01-01T00:00:00.000Z",
						},
						{
							relative_file_path: "newer.md",
							updated_at: "2026-09-01T00:00:00.000Z",
						},
					] as never,
				publishPath: ".magic",
			}),
		)

		await act(async () => {
			await result.current.checkBeforeContinue(continueAction)
		})
		render(result.current.noticeDialog)

		expect(noticeDialogPropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				outsidePaths: ["newer.md", "older.md", "unknown.md"],
			}),
		)
	})

	it("ignores configured system files when checking the notice", async () => {
		const continueAction = vi.fn()
		const { result } = renderHook(() =>
			usePublishScopeNotice({
				projectId: undefined,
				getAttachmentsStatus: () => ({ isLoaded: true, hasError: false }),
				getAttachments: () =>
					[{ relative_file_path: ".magic/skills/skill_config.yaml" }] as never,
				publishPath: ".magic/skills/demo",
				excludedPaths: [".magic/skills/skill_config.yaml"],
			}),
		)

		await act(async () => {
			await result.current.checkBeforeContinue(continueAction)
		})

		expect(continueAction).toHaveBeenCalledTimes(1)
	})
})
