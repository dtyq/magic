import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { createDirectoryMentionData } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import {
	handleAttachmentDragStart,
	insertMentionFromDroppedData,
	PROJECT_ATTACHMENT_DRAG_MIME,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"

vi.mock("@/stores/projectFiles", () => ({
	default: {
		currentSelectedProject: { id: "project-1" },
		workspaceFilesList: [],
		getFolderData: vi.fn(),
	},
}))
vi.mock("@/pages/superMagic/services/userFileReferenceResolver", () => ({
	getFileReferenceIdentityKey: () => "user-1",
	resolveFileReference: vi.fn(),
}))
vi.mock("@/pages/superMagic/components/MessageEditor/utils/dragLogger", () => ({
	dragLogger: {
		startSession: vi.fn(),
		logDragStart: vi.fn(),
		logEditorCheck: vi.fn(),
		logMentionInsert: vi.fn(),
	},
}))

describe("skill folder drag", () => {
	it("inserts a structured folder mention from the actual drag payload", async () => {
		const transfer = new Map<string, string>()
		const event = {
			dataTransfer: {
				types: [],
				setData: (key: string, value: string) => transfer.set(key, value),
			},
		} as unknown as React.DragEvent
		const folder = {
			file_id: "folder-1",
			file_name: "research",
			is_directory: true,
			relative_file_path: ".magic/skills/research",
			project_id: "project-1",
		}
		const mention = {
			type: MentionItemType.FOLDER as const,
			data: { ...createDirectoryMentionData(folder), project_id: "project-1" },
		}
		handleAttachmentDragStart(event, folder, mention)
		const editor = { isDestroyed: false, commands: { insertContent: vi.fn(), focus: vi.fn() } }
		await insertMentionFromDroppedData({
			editor,
			data: JSON.parse(transfer.get(PROJECT_ATTACHMENT_DRAG_MIME) || "null"),
		})
		expect(editor.commands.insertContent).toHaveBeenCalledWith([
			{ type: "mention", attrs: mention },
		])
		expect(editor.commands.focus).toHaveBeenCalledOnce()
	})
})
