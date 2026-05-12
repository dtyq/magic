import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { last } from "lodash-es"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { getItemId, getDirectoriesFromPath } from "../../../utils/attachmentUtils"

interface UseDirectoryNavigationOptions {
	onEnterDirectory?: () => void
}

export function useDirectoryNavigation(options: UseDirectoryNavigationOptions = {}) {
	const { onEnterDirectory } = options
	const { t } = useTranslation("super")

	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [path, setPath] = useState<AttachmentItem[]>([])
	const [directories, setDirectories] = useState<AttachmentItem[]>([])
	const [loading, setLoading] = useState(false)

	const filesSort = useMemoizedFn((files: AttachmentItem[]) => {
		return files.filter((item) => !item.is_hidden)
	})

	const fetchDirectories = useMemoizedFn(
		async (params: {
			projectId: string
			parentId?: string
			pathOverride?: AttachmentItem[]
		}) => {
			setLoading(true)
			try {
				const currentPath = params.pathOverride !== undefined ? params.pathOverride : path
				const dirs = getDirectoriesFromPath(attachments, currentPath)
				setDirectories(filesSort(dirs))
			} catch (error) {
				console.error("Failed to fetch directories:", error)
				setDirectories([])
			}
			setLoading(false)
		},
	)

	const loadProjectAttachments = useMemoizedFn(async (projectId: string) => {
		setLoading(true)
		try {
			const res = await SuperMagicApi.getAttachmentsByProjectId({
				projectId,
				temporaryToken:
					(window as Window & { temporary_token?: string }).temporary_token || "",
			})
			setAttachments(res?.tree || [])
			setPath([])
			const dirs = getDirectoriesFromPath(res?.tree || [], [])
			setDirectories(filesSort(dirs))
			return res?.tree || []
		} catch (error) {
			console.error("Failed to fetch attachments:", error)
			magicToast.error(t("selectPathModal.fetchAttachmentsFailed"))
			return []
		} finally {
			setLoading(false)
		}
	})

	const onDirectoryClick = useMemoizedFn(async (item: AttachmentItem, projectId: string) => {
		if (!item.is_directory) return

		const newPath = [...path, item]
		setPath(newPath)
		await fetchDirectories({
			projectId,
			parentId: getItemId(item),
			pathOverride: newPath,
		})
		onEnterDirectory?.()
	})

	const navigateToPath = useMemoizedFn(async (newPath: AttachmentItem[], projectId: string) => {
		setPath(newPath)
		const lastPath = last(newPath)
		await fetchDirectories({
			projectId,
			parentId: lastPath ? getItemId(lastPath) : undefined,
			pathOverride: newPath,
		})
	})

	const clearNavigation = useMemoizedFn(() => {
		setAttachments([])
		setPath([])
		setDirectories([])
	})

	return {
		attachments,
		path,
		directories,
		loading,
		setLoading,
		fetchDirectories,
		loadProjectAttachments,
		onDirectoryClick,
		navigateToPath,
		clearNavigation,
		setDirectories,
		filesSort,
	}
}
