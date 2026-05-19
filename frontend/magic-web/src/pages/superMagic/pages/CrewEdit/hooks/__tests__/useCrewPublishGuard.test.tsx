import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCrewPublishGuard } from "../useCrewPublishGuard"

const { warningMock } = vi.hoisted(() => ({
	warningMock: vi.fn(),
}))

vi.mock("../../store", () => ({
	CREW_EDIT_STEP: {
		Publishing: "Publishing",
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en_US" },
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		warning: warningMock,
	},
}))

type PublishGuardParams = Parameters<typeof useCrewPublishGuard>[0]

function createIdentityMock({
	hasName = true,
	ensureIdentityMarkdownFile = vi.fn().mockImplementation(() => Promise.resolve(true)),
	syncI18nFieldsToIdentityMarkdown = vi.fn().mockResolvedValue(true),
}: {
	hasName?: boolean
	ensureIdentityMarkdownFile?: ReturnType<typeof vi.fn>
	syncI18nFieldsToIdentityMarkdown?: ReturnType<typeof vi.fn>
} = {}) {
	const identity = {
		name_i18n: { default: hasName ? "Crew Name" : "" },
		role_i18n: { default: ["Role"] },
		description_i18n: { default: "Description" },
		ensureIdentityMarkdownFile,
		syncI18nFieldsToIdentityMarkdown,
		setI18nFields: vi.fn(async (update) => {
			identity.name_i18n = update.name_i18n
			identity.role_i18n = update.role_i18n
			identity.description_i18n = update.description_i18n
		}),
	}

	return identity
}

function createLayoutMock() {
	return {
		activeDetailKey: null,
		setActiveStep: vi.fn(),
	}
}

describe("useCrewPublishGuard", () => {
	it("ensures identity markdown file before opening publishing", async () => {
		const identity = createIdentityMock()
		const layout = createLayoutMock()
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		act(() => {
			result.current.handleOpenPublishing()
		})

		await waitFor(() => {
			expect(identity.ensureIdentityMarkdownFile).toHaveBeenCalledWith({
				projectId: "project-1",
			})
			expect(identity.syncI18nFieldsToIdentityMarkdown).toHaveBeenCalledWith({
				name_i18n: identity.name_i18n,
				role_i18n: identity.role_i18n,
				description_i18n: identity.description_i18n,
			})
			expect(openPublishingStep).toHaveBeenCalledTimes(1)
		})
	})

	it("sets publishing pending during publishing preparation", async () => {
		let resolveEnsure: ((value: boolean) => void) | null = null
		const identity = createIdentityMock({
			ensureIdentityMarkdownFile: vi.fn(
				() =>
					new Promise<boolean>((resolve) => {
						resolveEnsure = resolve
					}),
			),
		})
		const layout = createLayoutMock()
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		act(() => {
			result.current.handleOpenPublishing()
		})

		await waitFor(() => {
			expect(result.current.isPublishingPending).toBe(true)
		})

		await act(async () => {
			resolveEnsure?.(true)
		})

		await waitFor(() => {
			expect(result.current.isPublishingPending).toBe(false)
			expect(openPublishingStep).toHaveBeenCalledTimes(1)
		})
	})

	it("closes publishing immediately without pending when publishing is already active", () => {
		const identity = createIdentityMock()
		const layout = {
			...createLayoutMock(),
			activeDetailKey: "Publishing",
		}
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		act(() => {
			result.current.handleOpenPublishing()
		})

		expect(result.current.isPublishingPending).toBe(false)
		expect(openPublishingStep).toHaveBeenCalledTimes(1)
		expect(identity.ensureIdentityMarkdownFile).not.toHaveBeenCalled()
		expect(identity.syncI18nFieldsToIdentityMarkdown).not.toHaveBeenCalled()
	})

	it("shows warning but still opens publishing when markdown creation fails", async () => {
		const identity = createIdentityMock({
			ensureIdentityMarkdownFile: vi.fn().mockResolvedValue(false),
		})
		const layout = createLayoutMock()
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		act(() => {
			result.current.handleOpenPublishing()
		})

		await waitFor(() => {
			expect(warningMock).toHaveBeenCalledWith("errors.syncIdentityMarkdownFailed")
			expect(openPublishingStep).toHaveBeenCalledTimes(1)
		})
	})

	it("prepares publishing after identity dialog saves", async () => {
		const identity = createIdentityMock({ hasName: false })
		const layout = createLayoutMock()
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		await act(async () => {
			identity.name_i18n = { default: "New Publish Name" }
			await result.current.handlePublishIdentitySaved()
		})

		expect(identity.ensureIdentityMarkdownFile).toHaveBeenCalledWith({
			projectId: "project-1",
		})
		expect(identity.syncI18nFieldsToIdentityMarkdown).toHaveBeenCalledWith({
			name_i18n: { default: "New Publish Name" },
			role_i18n: identity.role_i18n,
			description_i18n: identity.description_i18n,
		})
		expect(openPublishingStep).toHaveBeenCalledTimes(1)
	})

	it("opens identity dialog when publishing name is missing", async () => {
		const identity = createIdentityMock({ hasName: false })
		const layout = createLayoutMock()
		const openPublishingStep = vi.fn()
		const { result } = renderHook(() =>
			useCrewPublishGuard({
				identity: identity as unknown as PublishGuardParams["identity"],
				layout: layout as unknown as PublishGuardParams["layout"],
				isInitializing: false,
				projectId: "project-1",
				openPublishingStep,
			}),
		)

		act(() => {
			result.current.handleOpenPublishing()
		})

		await waitFor(() => {
			expect(result.current.isPublishIdentityDialogOpen).toBe(true)
		})
		expect(openPublishingStep).not.toHaveBeenCalled()
		expect(identity.ensureIdentityMarkdownFile).not.toHaveBeenCalled()
	})
})
