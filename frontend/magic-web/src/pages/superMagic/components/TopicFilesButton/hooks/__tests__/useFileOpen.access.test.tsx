import { act, renderHook } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { describe, expect, it, vi } from "vitest"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { useFileOpen } from "../useFileOpen"

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({ getFileType: () => "md" }))

describe("file open scope", () => {
	it.each(["view", "preview"] as const)("blocks opening when %s is denied", (action) => {
		const onFileClick = vi.fn()
		const wrapper = ({ children }: PropsWithChildren) => (
			<FileAccessProvider permissions={{ [action]: false }}>{children}</FileAccessProvider>
		)
		const { result } = renderHook(() => useFileOpen({ onFileClick }), { wrapper })
		act(() => result.current.handleOpenFile({ file_id: "file-1", is_directory: false }))
		expect(onFileClick).not.toHaveBeenCalled()
	})
	it("does not prevent preview when only downloads are denied", () => {
		const onFileClick = vi.fn()
		const wrapper = ({ children }: PropsWithChildren) => (
			<FileAccessProvider permissions={{ download: false }}>{children}</FileAccessProvider>
		)
		const { result } = renderHook(() => useFileOpen({ onFileClick }), { wrapper })
		act(() => result.current.handleOpenFile({ file_id: "file-1", is_directory: false }))
		expect(onFileClick).toHaveBeenCalledOnce()
	})
})
