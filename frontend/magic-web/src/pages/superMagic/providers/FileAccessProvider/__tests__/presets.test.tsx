import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FileAccessProvider, VIEWER_FILE_CONFIG, useFileAccess } from ".."

describe("VIEWER_FILE_CONFIG", () => {
	it("keeps preview/download actions while hiding write and share actions", () => {
		const { result } = renderHook(useFileAccess, {
			wrapper: ({ children }) => (
				<FileAccessProvider {...VIEWER_FILE_CONFIG}>{children}</FileAccessProvider>
			),
		})

		expect(result.current.permissions).toEqual({
			download: true,
			export: true,
			preview: true,
			view: true,
			share: false,
		})
		expect(result.current.options).toMatchObject({
			copyTo: false,
			moveTo: false,
			shareTopic: false,
			createNewTopic: false,
			fullscreen: true,
		})
	})
})

vi.mock("@/pages/superMagic/providers/FileAccessProvider/hooks/useResolveFileAccess", () => ({
	useResolveFileAccess: () => ({}),
}))
