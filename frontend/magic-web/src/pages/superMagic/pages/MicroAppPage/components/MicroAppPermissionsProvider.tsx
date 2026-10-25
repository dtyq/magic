import { useMemo, type ReactNode } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { HtmlAppPermissionContext } from "@/pages/superMagic/components/Detail/contents/HTML/hooks/HtmlAppPermissionContext"
import { useHtmlAppPermissions } from "@/pages/superMagic/components/Detail/contents/HTML/hooks/useHtmlAppPermissions"

export default function MicroAppPermissionsProvider({
	appId,
	projectId,
	attachmentList,
	children,
}: {
	/** Stable micro app id; authorization is keyed on it so file edits, renames and moves keep grants. */
	appId: string
	projectId: string
	attachmentList: AttachmentItem[]
	children: ReactNode
}) {
	const fileList = useMemo(
		() =>
			attachmentList
				.filter((file) => !file.is_directory)
				.map((file) => ({
					file_id: file.file_id || "",
					relative_file_path: file.relative_file_path || file.file_name || "",
					updated_at: file.updated_at,
				})),
		[attachmentList],
	)
	// A MicroApp owns one root manifest and one authorization identity (its appId).
	// File content and sibling files never invalidate grants; only app.json declarations gate scopes.
	const controller = useHtmlAppPermissions({
		appId,
		projectId,
		relativeFilePath: "index.html",
		content: "",
		fileList,
		enabled: Boolean(projectId),
	})
	return (
		<HtmlAppPermissionContext.Provider value={controller}>
			{children}
		</HtmlAppPermissionContext.Provider>
	)
}
