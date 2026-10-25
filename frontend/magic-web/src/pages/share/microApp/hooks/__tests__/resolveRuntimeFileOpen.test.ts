import { describe, expect, it } from "vitest"

import { resolveRuntimeFileOpen } from "../resolveRuntimeFileOpen"

describe("resolveRuntimeFileOpen", () => {
	it("maps json and other code files to a previewable detail type", () => {
		expect(
			resolveRuntimeFileOpen({
				file_id: "file-2",
				file_name: "token.json",
				file_extension: "json",
				space_type: "user",
			}),
		).toEqual({
			kind: "preview",
			detail: expect.objectContaining({
				type: "code",
				currentFileId: "file-2",
				data: expect.objectContaining({
					file_id: "file-2",
					file_name: "token.json",
					file_extension: "json",
					space_type: "user",
				}),
			}),
		})
	})

	it("opens a regular file in the preview popup", () => {
		expect(
			resolveRuntimeFileOpen({
				file_id: "file-1",
				file_name: "notes.md",
				file_extension: "md",
			}),
		).toEqual({
			kind: "preview",
			detail: expect.objectContaining({
				type: "md",
				currentFileId: "file-1",
				data: expect.objectContaining({ file_id: "file-1", file_name: "notes.md" }),
			}),
		})
	})

	it("opens project and user file managers in the manager popup", () => {
		expect(
			resolveRuntimeFileOpen({
				file_manager: { spaceType: "project", projectId: "runtime-1" },
			}),
		).toEqual({
			kind: "file-manager",
			context: { spaceType: "project", projectId: "runtime-1" },
		})
		expect(
			resolveRuntimeFileOpen({
				file_manager: { spaceType: "user", view: "files" },
			}),
		).toEqual({
			kind: "file-manager",
			context: { spaceType: "user", view: "files" },
		})
	})

	it("ignores directories and empty payloads", () => {
		expect(resolveRuntimeFileOpen({ file_id: "dir-1", is_directory: true })).toEqual({
			kind: "ignore",
		})
		expect(resolveRuntimeFileOpen(undefined)).toEqual({ kind: "ignore" })
		expect(resolveRuntimeFileOpen({ file_manager: { spaceType: "project" } })).toEqual({
			kind: "ignore",
		})
	})
})
