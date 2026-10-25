import { beforeEach, describe, expect, it, vi } from "vitest"

import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getToolDetailSelectionTarget } from "../../../toolDetailSelection"
import { handleToolCallInteraction } from "../interactions"

const { projectFilesStoreMock } = vi.hoisted(() => ({
	projectFilesStoreMock: {
		workspaceFilesList: [] as Array<{ file_id?: string }>,
	},
}))

vi.mock("@/stores/projectFiles", () => ({
	default: projectFilesStoreMock,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo", () => ({
	getToolDesignProjectInfo: vi.fn(),
}))

describe("handleToolCallInteraction", () => {
	const publishSpy = vi.spyOn(pubsub, "publish")

	beforeEach(() => {
		publishSpy.mockClear()
		projectFilesStoreMock.workspaceFilesList = [
			{ file_id: "file-1" },
			{ file_id: "file-target" },
			{ file_id: "file-direct" },
		]
	})

	it("marks source-file interactions as file navigation", () => {
		const onSelectDetail = vi.fn()

		handleToolCallInteraction({
			toolData: {
				id: "tool-file-1",
				name: "write_file",
				action: "write file",
				attachments: [],
				detail: {
					type: "code",
					data: { source_file_id: "file-1" },
				},
			},
			onSelectDetail,
		})

		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "file-1",
		})
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Locate_File_In_Tree, "file-1")
		const selectedDetail = onSelectDetail.mock.calls[0][0]
		expect(selectedDetail).toEqual(
			expect.objectContaining({ id: "tool-file-1", isFromNode: true }),
		)
		expect(getToolDetailSelectionTarget(selectedDetail)).toBe("file")
	})

	it("supports target_file_id file navigation", () => {
		const onSelectDetail = vi.fn()

		handleToolCallInteraction({
			toolData: {
				id: "tool-file-legacy",
				name: "write_file",
				action: "write file",
				attachments: [],
				detail: { type: "code", data: { target_file_id: "file-target" } },
			},
			onSelectDetail,
		})

		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "file-target",
		})
		expect(getToolDetailSelectionTarget(onSelectDetail.mock.calls[0][0])).toBe("file")
	})

	it("falls back to playback when tool file_id is not in attachments", () => {
		const onSelectDetail = vi.fn()
		projectFilesStoreMock.workspaceFilesList = [{ file_id: "workspace-md" }]

		handleToolCallInteraction({
			toolData: {
				id: "call_f51449c8ea134bc69543e519",
				name: "browser_open_page",
				action: "打开网页",
				attachments: [],
				detail: {
					type: "browser",
					data: {
						url: "https://www.baidu.com/",
						file_id: "956201860725010433",
					},
				},
			},
			onSelectDetail,
		})

		expect(publishSpy).not.toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, expect.anything())
		expect(publishSpy).toHaveBeenCalledWith(
			PubSubEvents.Open_Playback_Tab,
			expect.objectContaining({ id: "call_f51449c8ea134bc69543e519" }),
		)
		expect(getToolDetailSelectionTarget(onSelectDetail.mock.calls[0][0])).toBe("detail")
	})

	it("keeps a bare file_id in the playback detail flow", () => {
		const onSelectDetail = vi.fn()

		handleToolCallInteraction({
			toolData: {
				id: "tool-file-legacy",
				name: "write_file",
				action: "write file",
				attachments: [],
				detail: { type: "code", data: { file_id: "file-direct" } },
			},
			onSelectDetail,
		})

		expect(publishSpy).toHaveBeenCalledWith(
			PubSubEvents.Open_Playback_Tab,
			expect.objectContaining({ data: { file_id: "file-direct" } }),
		)
		expect(publishSpy).not.toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, expect.anything())
		expect(getToolDetailSelectionTarget(onSelectDetail.mock.calls[0][0])).toBe("detail")
	})

	it("marks ordinary tool interactions as detail previews", () => {
		const onSelectDetail = vi.fn()

		handleToolCallInteraction({
			toolData: {
				id: "tool-detail-1",
				name: "shell_exec",
				action: "run command",
				attachments: [],
				detail: {
					type: "shell",
					data: { command: "pwd" },
				},
			},
			onSelectDetail,
		})

		expect(publishSpy).toHaveBeenCalledWith(
			PubSubEvents.Open_Playback_Tab,
			expect.objectContaining({ id: "tool-detail-1" }),
		)
		const selectedDetail = onSelectDetail.mock.calls[0][0]
		expect(selectedDetail).toEqual(
			expect.objectContaining({ id: "tool-detail-1", isFromNode: true }),
		)
		expect(getToolDetailSelectionTarget(selectedDetail)).toBe("detail")
	})
})
