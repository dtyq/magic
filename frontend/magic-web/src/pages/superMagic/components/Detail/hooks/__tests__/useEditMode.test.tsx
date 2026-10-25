import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import useEditMode from "../useEditMode"

const mockState = vi.hoisted(() => ({
	confirm: vi.fn(),
	joinFileEdit: vi.fn(),
	leaveFileEdit: vi.fn(),
	getFileEditCount: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		joinFileEdit: mockState.joinFileEdit,
		leaveFileEdit: mockState.leaveFileEdit,
		getFileEditCount: mockState.getFileEditCount,
	},
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: mockState.confirm,
	},
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: () => null,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: () => null,
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("lucide-react", () => ({
	ChevronDown: () => null,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

describe("useEditMode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockState.confirm.mockReturnValue({ destroy: vi.fn() })
	})

	it("asks for a close decision when a non-presence editor registers a save handler", async () => {
		const { result } = renderHook(() =>
			useEditMode({ fileId: "canvas-file", editingPresenceEnabled: false }),
		)
		const save = vi.fn().mockResolvedValue(undefined)

		let closePromise = Promise.resolve<"close" | "save" | "cancel">("cancel")
		act(() => {
			closePromise = result.current.checkBeforeClose(save)
		})

		expect(mockState.confirm).toHaveBeenCalledTimes(1)
		const config = mockState.confirm.mock.calls[0][0]

		act(() => {
			config.onCancel()
		})

		await expect(closePromise).resolves.toBe("cancel")
		expect(save).not.toHaveBeenCalled()
	})

	it("closes immediately when no editor save handler is registered", async () => {
		const { result } = renderHook(() =>
			useEditMode({ fileId: "canvas-file", editingPresenceEnabled: false }),
		)

		await expect(result.current.checkBeforeClose()).resolves.toBe("close")
		expect(mockState.confirm).not.toHaveBeenCalled()
	})

	it("silently saves and closes without showing the confirmation dialog", async () => {
		const { result } = renderHook(() =>
			useEditMode({
				fileId: "canvas-file",
				editingPresenceEnabled: false,
				silentClose: true,
			}),
		)
		const save = vi.fn().mockResolvedValue(undefined)

		await expect(result.current.checkBeforeClose(save)).resolves.toBe("save")

		expect(save).toHaveBeenCalledTimes(1)
		expect(mockState.confirm).not.toHaveBeenCalled()
	})

	it("does not wait for editing presence release during a silent close", async () => {
		let resolveLeave: (() => void) | undefined
		mockState.getFileEditCount.mockResolvedValue({ editing_user_count: 0 })
		mockState.joinFileEdit.mockResolvedValue(undefined)
		mockState.leaveFileEdit.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveLeave = resolve
				}),
		)

		const { result } = renderHook(() =>
			useEditMode({
				fileId: "canvas-file",
				editingPresenceEnabled: true,
				silentClose: true,
			}),
		)
		await act(async () => result.current.setIsEditMode(true))

		await expect(result.current.checkBeforeClose()).resolves.toBe("close")
		expect(mockState.leaveFileEdit).toHaveBeenCalledWith("canvas-file")

		await act(async () => {
			resolveLeave?.()
		})
	})
})
