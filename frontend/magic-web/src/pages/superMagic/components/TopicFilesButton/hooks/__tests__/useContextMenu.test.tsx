import { render, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { useContextMenu } from "../useContextMenu"
import type { AttachmentItem } from "../types"
import type { TopicFilesMenuItem } from "../../utils/menu-items"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@tabler/icons-react", () => {
	function IconStub() {
		return null
	}
	return {
		IconDownload: IconStub,
		IconEdit: IconStub,
		IconFolderPlus: IconStub,
		IconFolderUp: IconStub,
		IconUpload: IconStub,
		IconShare: IconStub,
		IconTrash: IconStub,
		IconFile: IconStub,
		IconMessageCircleShare: IconStub,
		IconMessageCirclePlus: IconStub,
		IconFolderSymlink: IconStub,
		IconReplace: IconStub,
		IconFolders: IconStub,
		IconSquareCheck: IconStub,
		IconInfoCircle: IconStub,
		IconCopy: IconStub,
	}
})

vi.mock("@/enhance/tabler/icons-react/icons/IconOpenWindow", () => ({
	default: () => null,
}))

vi.mock("antd", () => ({
	Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicIcon", () => ({ default: () => null }))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: () => null,
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn(),
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../../style", () => ({
	useStyles: () => ({
		styles: {
			danger: "danger",
			menuItemShortcut: "menuItemShortcut",
			menuItemShortcutItem: "menuItemShortcutItem",
		},
	}),
}))

vi.mock("../../components/MagicSystemFolderIcon", () => ({
	MagicSystemFolderIcon: () => null,
}))

vi.mock("../../../VIPTag", () => ({
	default: () => null,
}))

vi.mock("../useMobileDeleteConfirmSheet", () => ({
	useMobileDeleteConfirmSheet: () => ({
		deleteConfirmNode: null,
		openDeleteConfirm: vi.fn(),
	}),
}))

function createOptions(overrides: Partial<Parameters<typeof useContextMenu>[0]> = {}) {
	return {
		handleUploadFile: vi.fn(),
		handleUploadFolder: vi.fn(),
		handleShareItem: vi.fn(),
		handleDeleteItem: vi.fn(),
		handleDownloadOriginal: vi.fn(),
		handleDownloadPdf: vi.fn(),
		handleDownloadPptx: vi.fn(),
		handleOpenFile: vi.fn(),
		handleStartRename: vi.fn(),
		handleAddToCurrentChat: vi.fn(),
		handleAddToNewChat: vi.fn(),
		handleMoveFile: vi.fn(),
		handleReplaceFile: vi.fn(),
		onCopyFile: vi.fn(),
		createVirtualFile: vi.fn(),
		createVirtualFolder: vi.fn(),
		handleEnterMultiSelectMode: vi.fn(),
		...overrides,
	}
}

function getMenuKeys(items: TopicFilesMenuItem[]) {
	return items.filter((item) => item && item.type !== "divider").map((item) => String(item?.key))
}

function getSubMenuItems(items: TopicFilesMenuItem[], key: string): TopicFilesMenuItem[] {
	const item = items.find((menuItem) => menuItem?.key === key)
	if (!item || !("children" in item) || !Array.isArray(item.children)) return []
	return item.children as TopicFilesMenuItem[]
}

function getMenuGroups(items: TopicFilesMenuItem[]) {
	return items.reduce<string[][]>(
		(groups, item) => {
			if (!item) return groups
			if (item.type === "divider") {
				groups.push([])
				return groups
			}
			groups.at(-1)?.push(String(item.key))
			return groups
		},
		[[]],
	)
}

function expectCopyPathInReferenceGroup(keys: string[]) {
	const shareIndex = keys.indexOf("share")
	const copyPathIndex = keys.indexOf("copyPath")
	const selectMultipleIndex = keys.indexOf("selectMultiple")

	expect(shareIndex).toBeGreaterThanOrEqual(0)
	expect(copyPathIndex).toBeGreaterThan(shareIndex)
	expect(selectMultipleIndex).toBeGreaterThan(copyPathIndex)
}

describe("useContextMenu copy path menu", () => {
	it("places copy path in the reference group for file rows", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			name: "report.md",
			is_directory: false,
			relative_file_path: "/docs/report.md",
		}

		const { result } = renderHook(() => useContextMenu(createOptions()))
		const keys = getMenuKeys(result.current.getMenuItems(file))

		expect(keys).toContain("copyPath")
		expectCopyPathInReferenceGroup(keys)
	})

	it("places copy path in the reference group for folder rows", () => {
		const folder: AttachmentItem = {
			file_id: "folder-1",
			name: "docs",
			is_directory: true,
			relative_file_path: "/docs",
			children: [],
		}

		const { result } = renderHook(() => useContextMenu(createOptions()))
		const keys = getMenuKeys(result.current.getMenuItems(folder))

		expect(keys).toContain("copyPath")
		expectCopyPathInReferenceGroup(keys)
	})
})

describe("useContextMenu project creation menu", () => {
	it("hides project creation entries in slide project folders", () => {
		const createVirtualDesignProject = vi.fn()
		const createVirtualSelfMediaProject = vi.fn()
		const createVirtualAICardProject = vi.fn()
		const folder: AttachmentItem = {
			file_id: "slide-folder-1",
			name: "季度汇报",
			is_directory: true,
			relative_file_path: "/季度汇报",
			display_config: { type: "slide" },
			children: [],
		}

		const { result } = renderHook(() =>
			useContextMenu(
				createOptions({
					createVirtualDesignProject,
					createVirtualSelfMediaProject,
					createVirtualAICardProject,
				}),
			),
		)
		const createItems = getSubMenuItems(result.current.getMenuItems(folder), "createFile")
		const createKeys = getMenuKeys(createItems)

		expect(createKeys).not.toContain("createDesign")
		expect(createKeys).not.toContain("createSelfMedia")
		expect(createKeys).not.toContain("createAICard")
		expect(createVirtualDesignProject).not.toHaveBeenCalled()
		expect(createVirtualSelfMediaProject).not.toHaveBeenCalled()
		expect(createVirtualAICardProject).not.toHaveBeenCalled()
	})
})

function createSlidesTemplateFolder(): AttachmentItem {
	return {
		file_id: "template-folder-1",
		name: "Brand template",
		is_directory: true,
		children: [
			{ name: "template.json", is_directory: false },
			{ name: "visual-spec.md", is_directory: false },
			{ name: "theme.css", is_directory: false },
			{ name: "slides", is_directory: true, children: [] },
		],
	}
}

describe("useContextMenu slide template actions", () => {
	it("shows save for a recognized template folder", () => {
		const handleSaveSlidesTemplate = vi.fn()
		const { result } = renderHook(() =>
			useContextMenu(createOptions({ handleSaveSlidesTemplate })),
		)

		const items = result.current.getMenuItems(createSlidesTemplateFolder())
		expect(getMenuKeys(items)).toContain("saveSlidesTemplate")
		expect(getMenuGroups(items)).toContainEqual(["saveSlidesTemplate"])
		render(<>{items.find((item) => item?.key === "saveSlidesTemplate")?.icon}</>)
		expect(document.querySelector('[data-testid="ppt-menu-icon"]')).toBeTruthy()
		items.find((item) => item?.key === "saveSlidesTemplate")?.onClick?.({} as never)
		expect(handleSaveSlidesTemplate).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "template-folder-1" }),
		)
	})

	it("shows convert for an existing PPT project folder", () => {
		const handleConvertToSlidesTemplate = vi.fn()
		const folder: AttachmentItem = {
			file_id: "slide-project-1",
			name: "Quarterly deck",
			is_directory: true,
			display_config: { type: "slide" },
			children: [],
		}
		const { result } = renderHook(() =>
			useContextMenu(createOptions({ handleConvertToSlidesTemplate })),
		)

		const items = result.current.getMenuItems(folder)
		expect(getMenuKeys(items)).toContain("convertToSlidesTemplate")
		expect(getMenuGroups(items)).toContainEqual(["convertToSlidesTemplate"])
		render(<>{items.find((item) => item?.key === "convertToSlidesTemplate")?.icon}</>)
		expect(document.querySelector('[data-testid="ppt-menu-icon"]')).toBeTruthy()
		items.find((item) => item?.key === "convertToSlidesTemplate")?.onClick?.({} as never)
		expect(handleConvertToSlidesTemplate).toHaveBeenCalledWith(folder)
	})

	it("does not show slide template actions for an ordinary folder", () => {
		const { result } = renderHook(() =>
			useContextMenu(
				createOptions({
					handleSaveSlidesTemplate: vi.fn(),
					handleConvertToSlidesTemplate: vi.fn(),
				}),
			),
		)

		const keys = getMenuKeys(
			result.current.getMenuItems({
				file_id: "folder-1",
				name: "Documents",
				is_directory: true,
				children: [],
			}),
		)
		expect(keys).not.toContain("saveSlidesTemplate")
		expect(keys).not.toContain("convertToSlidesTemplate")
	})

	it("shows only save when a folder is both a template and a PPT project", () => {
		const folder = createSlidesTemplateFolder()
		folder.display_config = { type: "slide" }
		const { result } = renderHook(() =>
			useContextMenu(
				createOptions({
					handleSaveSlidesTemplate: vi.fn(),
					handleConvertToSlidesTemplate: vi.fn(),
				}),
			),
		)

		const keys = getMenuKeys(result.current.getMenuItems(folder))
		expect(keys).toContain("saveSlidesTemplate")
		expect(keys).not.toContain("convertToSlidesTemplate")
	})

	it("hides both actions when callbacks are not injected", () => {
		const folder = createSlidesTemplateFolder()
		const { result } = renderHook(() => useContextMenu(createOptions()))

		const keys = getMenuKeys(result.current.getMenuItems(folder))
		expect(keys).not.toContain("saveSlidesTemplate")
		expect(keys).not.toContain("convertToSlidesTemplate")
	})

	it.each(["ppt", "pptx", "potx"])("shows convert for a %s file", (extension) => {
		const handleConvertToSlidesTemplate = vi.fn()
		const file: AttachmentItem = {
			file_id: `deck.${extension}`,
			name: `deck.${extension}`,
			file_extension: extension,
			is_directory: false,
		}
		const { result } = renderHook(() =>
			useContextMenu(createOptions({ handleConvertToSlidesTemplate })),
		)

		const items = result.current.getMenuItems(file)
		expect(getMenuKeys(items)).toContain("convertToSlidesTemplate")
		expect(getMenuGroups(items)).toContainEqual(["convertToSlidesTemplate"])
		items.find((item) => item?.key === "convertToSlidesTemplate")?.onClick?.({} as never)
		expect(handleConvertToSlidesTemplate).toHaveBeenCalledWith(file)
	})

	it("does not show convert for a non-presentation file", () => {
		const { result } = renderHook(() =>
			useContextMenu(createOptions({ handleConvertToSlidesTemplate: vi.fn() })),
		)

		const keys = getMenuKeys(
			result.current.getMenuItems({
				file_id: "notes-1",
				name: "notes.txt",
				file_extension: "txt",
				is_directory: false,
			}),
		)
		expect(keys).not.toContain("convertToSlidesTemplate")
	})
})
