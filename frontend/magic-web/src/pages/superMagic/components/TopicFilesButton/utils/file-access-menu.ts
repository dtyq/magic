import type { Key } from "react"
import type { FileAccessState } from "@/pages/superMagic/providers/FileAccessProvider"

// Menu keys belong to this feature, keeping the shared scope independent of UI implementations.
const actions: Record<string, keyof FileAccessState> = {
	download: "download",
	downloadOriginal: "download",
	downloadFolder: "download",
	downloadImage: "download",
	downloadImageNoWaterMark: "download",
	"download-selected": "download",
	batchZip: "download",
	downloadPdf: "export",
	downloadPpt: "export",
	downloadPptx: "export",
	downloadAsImage: "export",
	downloadImagePng: "export",
	downloadImageJpeg: "export",
	"export-pdf": "export",
	"export-ppt": "export",
	share: "share",
	openFile: "preview",
}

type AccessMenuItem = { key?: Key; children?: (AccessMenuItem | null)[] } | null

/** Mixed download/export groups remain visible while at least one child is allowed. */
export function filterFileAccessMenuItems<T extends AccessMenuItem>(
	items: T[],
	access: Readonly<FileAccessState>,
): T[] {
	return items.flatMap((item): T[] => {
		if (!item) return []
		if (item.children) {
			const children = filterFileAccessMenuItems(item.children, access)
			return children.length ? [{ ...item, children }] : []
		}
		const action = actions[String(item.key)]
		if (action && !access[action]) return []
		if (item.key === "openFile" && !access.view) return []
		return [item]
	})
}
