import { createElement, type ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createSessionFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { IntermediateMessageType } from "@/types/chat/intermediate_message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useUserFileEditor } from "../useUserFileEditor"

const serviceMocks = vi.hoisted(() => ({
	readStableSnapshot: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/services/userFileReferenceResolver", () => ({
	getFileReferenceIdentityKey: () => "identity-1",
}))

vi.mock("@/stores/userFiles", () => ({
	default: {
		setFileEditing: vi.fn(),
		files: new Map(),
		loadDirectory: vi.fn(),
	},
}))

vi.mock("../../LongTremMemory/services/memoryThreeWayMerge", () => ({
	mergeMemoryContent: vi.fn(),
}))

vi.mock("../../services/userSpaceFileService", () => ({
	userSpaceFileService: {
		readStableSnapshot: serviceMocks.readStableSnapshot,
		saveFileContent: vi.fn(),
	},
	UserFileConcurrentModificationError: class UserFileConcurrentModificationError extends Error {},
}))

describe("useUserFileEditor", () => {
	beforeEach(() => {
		serviceMocks.readStableSnapshot.mockReset()
		serviceMocks.readStableSnapshot.mockResolvedValue({
			file: { id: "file-1", parent_id: "root", version: 1 },
			content: "# notes",
			revision: 1,
		})
	})

	it("reads snapshots with the ambient session file access", async () => {
		const access = createSessionFileAccess({ projectId: "runtime-1" })
		renderHook(() => useUserFileEditor("file-1", false, "identity-1"), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(FileAccessProvider, { value: access }, children),
		})

		await waitFor(() => {
			expect(serviceMocks.readStableSnapshot).toHaveBeenCalledWith(
				"file-1",
				expect.any(AbortSignal),
				access,
			)
		})
	})

	it("reloads an open preview when another tab saves the same user file", async () => {
		const access = createSessionFileAccess({ projectId: "runtime-1" })
		renderHook(() => useUserFileEditor("file-1", false, "identity-1"), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(FileAccessProvider, { value: access }, children),
		})
		await waitFor(() => expect(serviceMocks.readStableSnapshot).toHaveBeenCalledTimes(1))

		serviceMocks.readStableSnapshot.mockResolvedValueOnce({
			file: { id: "file-1", parent_id: "root", version: 2 },
			content: "# updated",
			revision: 2,
		})
		pubsub.publish(PubSubEvents.Super_Magic_File_Change_Intermediate, {
			message: {
				type: IntermediateMessageType.SuperMagicFileChange,
				space_type: "user",
				project_id: "",
				workspace_id: "",
				topic_id: "",
				timestamp: "2026-10-13T16:37:35+08:00",
				changes: [{ operation: "update", file_id: "file-1" }],
			},
		})

		await waitFor(() => expect(serviceMocks.readStableSnapshot).toHaveBeenCalledTimes(2))
	})
})
