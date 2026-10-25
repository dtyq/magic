import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	findFilesOutsidePublishRoot,
	findPublishScopeFilesOutsideRoot,
	hasFilesOutsidePublishRoot,
} from "../publish-scope"

function file(path: string, extra: Partial<AttachmentItem> = {}): AttachmentItem {
	return { relative_file_path: path, type: "file", ...extra }
}

function directory(path: string, children: AttachmentItem[] = []): AttachmentItem {
	return {
		relative_file_path: path,
		type: "directory",
		is_directory: true,
		children,
	}
}

describe("publish scope", () => {
	it("ignores files under .magic and the .magic directory itself", () => {
		expect(
			findFilesOutsidePublishRoot([
				directory(".magic"),
				file(".magic/IDENTITY.md"),
				file(".magic\\skills\\demo\\SKILL.md"),
			]),
		).toEqual([])
	})

	it("reports root and nested files outside .magic", () => {
		expect(findFilesOutsidePublishRoot([file("README.md"), file("docs/guide.md")])).toEqual([
			"README.md",
			"docs/guide.md",
		])
	})

	it("orders outside files by latest modification time", () => {
		expect(
			findPublishScopeFilesOutsideRoot([
				file("older.md", { updated_at: "2026-01-01T00:00:00.000Z" }),
				file("newer.md", { updated_at: "2026-09-01T00:00:00.000Z" }),
				file("unknown.md"),
			]),
		).toEqual([
			{ path: "newer.md", updatedAt: "2026-09-01T00:00:00.000Z" },
			{ path: "older.md", updatedAt: "2026-01-01T00:00:00.000Z" },
			{ path: "unknown.md", updatedAt: undefined },
		])
	})

	it("does not treat .magical as .magic", () => {
		expect(hasFilesOutsidePublishRoot([file(".magical/config.json")])).toBe(true)
	})

	it("ignores directory entries but walks tree children", () => {
		expect(
			findFilesOutsidePublishRoot([
				directory("assets", [
					file("logo.svg", { relative_file_path: undefined, file_name: "logo.svg" }),
				]),
			]),
		).toEqual(["assets/logo.svg"])
	})

	it("does not use file_key as a project-relative path", () => {
		expect(
			findFilesOutsidePublishRoot([{ file_key: "/notes/todo.txt", type: "file" }]),
		).toEqual([])
	})
})
