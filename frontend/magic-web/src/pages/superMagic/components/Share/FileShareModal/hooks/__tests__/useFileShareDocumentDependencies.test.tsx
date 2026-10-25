import { act, renderHook, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSingleDocumentStaticDependencies } from "@/pages/superMagic/hooks/useSingleDocumentStaticDependencies"
import { resolveShareDocumentDependencies } from "../resolveShareDocumentDependencies"
import { useFileShareDocumentDependencies } from "../useFileShareDocumentDependencies"

vi.mock("@/pages/superMagic/hooks/useSingleDocumentStaticDependencies", () => ({
	useSingleDocumentStaticDependencies: vi.fn(),
}))

vi.mock("../resolveShareDocumentDependencies", () => ({
	resolveShareDocumentDependencies: vi.fn(),
}))

const attachments = [
	{
		file_id: "index-html",
		file_name: "index.html",
		file_extension: "html",
	},
]

function renderDocumentDependencyHook(initialFileIds: string[]) {
	return renderHook(() => {
		const [selectedFileIds, setSelectedFileIds] = useState(initialFileIds)
		const documentDependencies = useFileShareDocumentDependencies({
			selectedFileIds,
			setSelectedFileIds,
			attachments,
			shareProject: false,
		})

		return {
			selectedFileIds,
			...documentDependencies,
		}
	})
}

describe("useFileShareDocumentDependencies", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(resolveShareDocumentDependencies).mockResolvedValue({
			dependencyFileIds: [],
			missingResourcePaths: [],
		})
		vi.mocked(useSingleDocumentStaticDependencies).mockReturnValue({
			fileId: "index-html",
			isLoading: false,
			fileType: "html",
			dependencyFileIds: ["image-1"],
			dependencyTransferFileIds: ["image-1"],
			missingResourcePaths: [],
			error: null,
		})
	})

	it("automatically checks resolved resources so the tree and submit payload stay aligned", async () => {
		const { result } = renderDocumentDependencyHook(["index-html"])

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
		})
		expect(result.current.fileIdsForSubmission).toEqual(["index-html", "image-1"])
	})

	it("unchecks automatically selected resources from both the tree and the submit payload", async () => {
		const { result } = renderDocumentDependencyHook(["index-html"])

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
		})

		act(() => {
			result.current.setIncludeDocumentDependencies(false)
		})

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["index-html"])
		})
		expect(result.current.fileIdsForSubmission).toEqual(["index-html"])
	})

	it("keeps resources the user selected themselves when dependency carrying is turned off", async () => {
		const { result } = renderDocumentDependencyHook(["index-html", "image-1"])

		act(() => {
			result.current.setIncludeDocumentDependencies(false)
		})

		expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
		expect(result.current.fileIdsForSubmission).toEqual(["index-html", "image-1"])
	})

	it("treats a tree-level resource deselect as opting out of carrying dependencies", async () => {
		const { result } = renderDocumentDependencyHook(["index-html"])

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
		})

		act(() => {
			result.current.handleFileIdsChange(["index-html"])
		})

		await waitFor(() => {
			expect(result.current.includeDocumentDependencies).toBe(false)
		})
		expect(result.current.selectedFileIds).toEqual(["index-html"])
		expect(result.current.fileIdsForSubmission).toEqual(["index-html"])
	})

	it("keeps HTML dependencies when unrelated files are selected or deselected", async () => {
		const { result } = renderDocumentDependencyHook(["index-html"])

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
		})

		act(() => {
			result.current.handleFileIdsChange(["index-html", "image-1", "notes-pdf"])
		})

		expect(result.current.includeDocumentDependencies).toBe(true)
		expect(result.current.selectedFileIds).toEqual(["index-html", "image-1", "notes-pdf"])
		expect(result.current.fileIdsForSubmission).toEqual(["index-html", "image-1", "notes-pdf"])

		act(() => {
			result.current.handleFileIdsChange(["index-html", "image-1"])
		})

		expect(result.current.includeDocumentDependencies).toBe(true)
		expect(result.current.selectedFileIds).toEqual(["index-html", "image-1"])
	})

	it("does not apply automatic resources to a multi-file selection", () => {
		const { result } = renderDocumentDependencyHook(["index-html", "another-file"])

		expect(result.current.selectedFileIds).toEqual(["index-html", "another-file"])
		expect(result.current.fileIdsForSubmission).toEqual(["index-html", "another-file"])
	})

	it("keeps the current files shareable while the recording bundle is not ready", () => {
		const { result } = renderHook(() => {
			const [selectedFileIds, setSelectedFileIds] = useState(["audio-file"])
			const documentDependencies = useFileShareDocumentDependencies({
				selectedFileIds,
				setSelectedFileIds,
				attachments: [{ file_id: "audio-file", file_name: "recording.wav" }],
				shareProject: false,
				dependencyAttachments: [{ file_id: "audio-file", file_name: "recording.wav" }],
				analyzeSelectedDocuments: true,
				autoIncludeDocumentDependencies: true,
			})

			return { selectedFileIds, ...documentDependencies }
		})

		expect(result.current.analysisError).toBeNull()
		expect(result.current.isAnalyzing).toBe(false)
		expect(result.current.fileIdsForSubmission).toEqual(["audio-file"])
	})

	it("reanalyzes updated recording attachments after the bundle becomes ready", async () => {
		vi.mocked(resolveShareDocumentDependencies).mockResolvedValue({
			dependencyFileIds: ["image-1"],
			missingResourcePaths: [],
		})
		const initialAttachments = [{ file_id: "audio-file", file_name: "recording.wav" }]
		const readyAttachments = [
			...initialAttachments,
			{ file_id: "summary-file", file_name: "summary.md" },
			{ file_id: "image-1", file_name: "image.png" },
		]

		const { result, rerender } = renderHook(
			({
				bundleRootPath,
				dependencyAttachments,
			}: {
				bundleRootPath?: string
				dependencyAttachments: typeof initialAttachments
			}) => {
				const [selectedFileIds, setSelectedFileIds] = useState(["summary-file"])
				const documentDependencies = useFileShareDocumentDependencies({
					selectedFileIds,
					setSelectedFileIds,
					attachments: dependencyAttachments,
					shareProject: false,
					dependencyAttachments,
					dependencyBundleRootPath: bundleRootPath,
					analyzeSelectedDocuments: true,
					autoIncludeDocumentDependencies: true,
				})

				return { selectedFileIds, ...documentDependencies }
			},
			{
				initialProps: {
					bundleRootPath: undefined,
					dependencyAttachments: initialAttachments,
				},
			},
		)

		expect(result.current.fileIdsForSubmission).toEqual(["summary-file"])
		rerender({ bundleRootPath: "recording-bundle", dependencyAttachments: readyAttachments })

		await waitFor(() => {
			expect(resolveShareDocumentDependencies).toHaveBeenCalledWith({
				selectedFileIds: ["summary-file"],
				attachments: readyAttachments,
				bundleRootPath: "recording-bundle",
				requireBundleRootPath: true,
			})
			expect(result.current.fileIdsForSubmission).toEqual(["summary-file", "image-1"])
		})
	})

	it("keeps the selected recording file when ready-bundle dependency analysis fails", async () => {
		vi.mocked(resolveShareDocumentDependencies).mockRejectedValue(
			new Error("temporary failure"),
		)
		const { result } = renderHook(() => {
			const [selectedFileIds, setSelectedFileIds] = useState(["summary-file"])
			const documentDependencies = useFileShareDocumentDependencies({
				selectedFileIds,
				setSelectedFileIds,
				attachments: [{ file_id: "summary-file", file_name: "summary.md" }],
				shareProject: false,
				dependencyAttachments: [{ file_id: "summary-file", file_name: "summary.md" }],
				dependencyBundleRootPath: "recording-bundle",
				analyzeSelectedDocuments: true,
				autoIncludeDocumentDependencies: true,
			})

			return { selectedFileIds, ...documentDependencies }
		})

		await waitFor(() => expect(result.current.analysisError).toBeInstanceOf(Error))
		expect(result.current.fileIdsForSubmission).toEqual(["summary-file"])
	})

	it("applies the same automatic selection flow to Markdown dependencies", async () => {
		vi.mocked(useSingleDocumentStaticDependencies).mockReturnValue({
			fileId: "readme-md",
			isLoading: false,
			fileType: "markdown",
			dependencyFileIds: ["cover-image"],
			dependencyTransferFileIds: ["assets-folder"],
			missingResourcePaths: [],
			error: null,
		})

		const { result } = renderDocumentDependencyHook(["readme-md"])

		await waitFor(() => {
			expect(result.current.selectedFileIds).toEqual(["readme-md", "cover-image"])
		})
		expect(result.current.dependencyFileType).toBe("markdown")
	})
})
