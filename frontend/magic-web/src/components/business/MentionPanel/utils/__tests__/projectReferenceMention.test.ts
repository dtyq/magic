import { describe, expect, it } from "vitest"
import {
	getProjectFileResourceIdentity,
	normalizeProjectFileResourcePath,
	resolveFolderWorkspaceEntryFromProjectFile,
	resolveFolderWorkspaceEntryFromTab,
} from "../projectReferenceMention"
import type { TabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { WorkspaceFolder } from "@/stores/projectFiles/types"

const parentFolder = {
	type: "directory",
	file_id: "dashboard-dir",
	file_name: "Dashboard",
	relative_file_path: "/Dashboard",
	display_config: { type: "dashboard" },
	children: [],
} as unknown as WorkspaceFolder

const plainParentFolder = {
	type: "directory",
	file_id: "plain-dir",
	file_name: "Plain",
	relative_file_path: "/Plain",
	children: [],
} as unknown as WorkspaceFolder

function createOptions(folders: WorkspaceFolder[]) {
	return {
		getFolderData: (parentId: string | number | undefined) =>
			folders.find((folder) => String(folder.file_id) === String(parentId)),
		workspaceFilesList: folders,
	}
}

function createEntryTab(displayConfig: Record<string, unknown> | undefined): TabItem {
	return {
		id: "entry-file",
		title: "Dashboard",
		filePath: "/Dashboard/index.html",
		active: true,
		closeable: true,
		fileData: {
			file_id: "entry-file",
			file_name: "index.html",
			relative_file_path: "/Dashboard/index.html",
			parent_id: parentFolder.file_id,
			display_config: displayConfig,
		},
	}
}

describe("projectReferenceMention", () => {
	it("uses file ids before normalized paths for resource identity", () => {
		expect(
			getProjectFileResourceIdentity({
				file_id: "file-1",
				relative_file_path: ".\\folder\\image.png/",
			}),
		).toBe("project-file:id:file-1")
		expect(normalizeProjectFileResourcePath(".\\folder\\image.png/")).toBe("folder/image.png")
		expect(
			getProjectFileResourceIdentity({ relative_file_path: ".\\folder\\image.png/" }),
		).toBe("project-file:path:folder/image.png")
	})

	it("resolves typed index entry files to their parent folder", () => {
		const folder = resolveFolderWorkspaceEntryFromTab(
			createEntryTab({ type: "dashboard" }),
			createOptions([parentFolder]),
		)

		expect(folder?.file_id).toBe(parentFolder.file_id)
	})

	it("resolves typed index files when only the file carries metadata", () => {
		const folder = resolveFolderWorkspaceEntryFromTab(
			{
				...createEntryTab({ type: "dashboard" }),
				filePath: "/Plain/index.html",
				fileData: {
					...createEntryTab({ type: "dashboard" }).fileData,
					parent_id: plainParentFolder.file_id,
					relative_file_path: "/Plain/index.html",
				},
			},
			createOptions([plainParentFolder]),
		)

		expect(folder?.file_id).toBe(plainParentFolder.file_id)
	})

	it("does not treat untyped index files as folder entry files", () => {
		const folder = resolveFolderWorkspaceEntryFromTab(
			{
				...createEntryTab({ name: "plain html" }),
				filePath: "/Plain/index.html",
				fileData: {
					...createEntryTab({ name: "plain html" }).fileData,
					parent_id: plainParentFolder.file_id,
					relative_file_path: "/Plain/index.html",
				},
			},
			createOptions([plainParentFolder]),
		)

		expect(folder).toBeNull()
	})

	it("resolves declared micro-app entry files to their parent folder", () => {
		const microAppFolder = {
			type: "directory",
			file_id: "micro-app-dir",
			file_name: "Micro App",
			relative_file_path: "/Micro App",
			display_config: {
				type: "micro-app",
				entry: "main.html",
			},
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromProjectFile(
			{
				file_id: "micro-entry",
				file_name: "main.html",
				relative_file_path: "/Micro App/main.html",
				parent_id: microAppFolder.file_id,
				display_config: {
					type: "micro-app",
					entry: "main.html",
				},
			},
			createOptions([microAppFolder]),
		)

		expect(folder?.file_id).toBe(microAppFolder.file_id)
	})

	it("resolves slide index entry files to their parent PPT folder", () => {
		const slideFolder = {
			type: "directory",
			file_id: "slide-dir",
			file_name: "PPT",
			relative_file_path: "/PPT",
			display_config: {
				type: "slide",
				slides: ["slides/page-1.html", "slides/page-2.html"],
			},
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromProjectFile(
			{
				file_id: "slide-entry",
				file_name: "index.html",
				relative_file_path: "/PPT/index.html",
				parent_id: slideFolder.file_id,
				display_config: slideFolder.display_config,
			},
			createOptions([slideFolder]),
		)

		expect(folder?.file_id).toBe(slideFolder.file_id)
	})

	it("does not resolve slide page files to their parent PPT folder", () => {
		const slideFolder = {
			type: "directory",
			file_id: "slide-dir",
			file_name: "PPT",
			relative_file_path: "/PPT",
			display_config: {
				type: "slide",
				slides: ["slides/page-1.html", "slides/page-2.html"],
			},
			children: [],
		} as unknown as WorkspaceFolder
		const slidesFolder = {
			type: "directory",
			file_id: "slides-dir",
			file_name: "slides",
			relative_file_path: "/PPT/slides",
			parent_id: slideFolder.file_id,
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromProjectFile(
			{
				file_id: "slide-page",
				file_name: "page-1.html",
				relative_file_path: "/PPT/slides/page-1.html",
				parent_id: slidesFolder.file_id,
				display_config: slideFolder.display_config,
			},
			createOptions([slideFolder, slidesFolder]),
		)

		expect(folder).toBeNull()
	})

	it("resolves legacy custom root_path entry files", () => {
		const customFolder = {
			type: "directory",
			file_id: "custom-dir",
			file_name: "Custom App",
			relative_file_path: "/Custom App",
			display_config: {
				type: "custom",
				root_path: "legacy.html",
			},
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromProjectFile(
			{
				file_id: "legacy-entry",
				file_name: "legacy.html",
				relative_file_path: "/Custom App/legacy.html",
				parent_id: customFolder.file_id,
				display_config: {
					type: "custom",
					root_path: "legacy.html",
				},
			},
			createOptions([customFolder]),
		)

		expect(folder?.file_id).toBe(customFolder.file_id)
	})

	it("resolves nested custom entry files to the custom root folder", () => {
		const customFolder = {
			type: "directory",
			file_id: "custom-root",
			file_name: "Custom Root",
			relative_file_path: "/Custom Root",
			display_config: {
				type: "custom",
				index: "pages/app.html",
			},
			children: [],
		} as unknown as WorkspaceFolder
		const nestedFolder = {
			type: "directory",
			file_id: "custom-pages",
			file_name: "pages",
			relative_file_path: "/Custom Root/pages",
			parent_id: customFolder.file_id,
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromProjectFile(
			{
				file_id: "custom-entry",
				file_name: "app.html",
				relative_file_path: "/Custom Root/pages/app.html",
				parent_id: nestedFolder.file_id,
				display_config: {
					type: "custom",
					index: "pages/app.html",
					_customFolderId: customFolder.file_id,
				},
			},
			createOptions([customFolder, nestedFolder]),
		)

		expect(folder?.file_id).toBe(customFolder.file_id)
	})

	it("uses tab filePath as a parent lookup fallback", () => {
		const fallbackFolder = {
			type: "directory",
			file_id: "fallback-dir",
			file_name: "Fallback App",
			relative_file_path: "/Fallback App",
			display_config: { type: "dashboard" },
			children: [],
		} as unknown as WorkspaceFolder

		const folder = resolveFolderWorkspaceEntryFromTab(
			{
				id: "fallback-entry",
				title: "Fallback App",
				filePath: "/Fallback App/index.html",
				active: true,
				closeable: true,
				fileData: {
					file_id: "fallback-entry",
					file_name: "index.html",
					display_config: { type: "dashboard" },
				},
			},
			createOptions([fallbackFolder]),
		)

		expect(folder?.file_id).toBe(fallbackFolder.file_id)
	})
})
