import type { TFunction } from "i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	buildDefaultSkillConfigYaml,
	findAttachmentByRelativePath,
	findDirectoryIdByRelativePath,
	findDirectoryIdBySegmentWalk,
	pickLastModifiedSkillDirWithSkillMd,
	SKILL_CONFIG_FILE_NAME,
	SKILL_CONFIG_RELATIVE_PATH,
} from "./skill-workspace-manifest"

const MAGIC_SKILLS_FOLDER_SEGMENTS = [".magic", "skills"] as const

const ATTACHMENTS_HYDRATION_MAX_MS = 2200
const ATTACHMENTS_AFTER_EVENT_MS = 80

let ensurePublishInFlight: Promise<boolean> | null = null

function waitForAttachmentsListHydration(timeoutMs: number): Promise<void> {
	return new Promise((resolve) => {
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, onAttachments)
			resolve()
		}
		const onAttachments = () => {
			setTimeout(finish, ATTACHMENTS_AFTER_EVENT_MS)
		}
		pubsub.subscribe(PubSubEvents.Update_Attachments, onAttachments)
		const timer = setTimeout(finish, timeoutMs)
	})
}

async function ensureFolderChain(
	projectId: string,
	segments: readonly string[],
	flatList: AttachmentItem[],
	fileTree: AttachmentItem[],
): Promise<string | number> {
	let parentId: string | number = ""
	let cumulative = ""

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]
		cumulative = i === 0 ? segment : `${cumulative}/${segment}`
		const pathSegments = segments.slice(0, i + 1)

		const existingId =
			findDirectoryIdByRelativePath(flatList, cumulative) ??
			findDirectoryIdBySegmentWalk(fileTree, pathSegments)
		if (existingId) {
			parentId = existingId
			continue
		}

		const res = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentId,
			file_name: segment,
			is_directory: true,
		})
		if (!res?.file_id) throw new Error("createFolderFailed")
		parentId = res.file_id
	}
	return parentId
}

export async function ensureSkillConfigYamlForPublish(options: {
	projectId: string | undefined
	getWorkspaceFilesList: () => AttachmentItem[]
	getWorkspaceFileTree: () => AttachmentItem[]
	t: TFunction<"crew/market">
}): Promise<boolean> {
	if (ensurePublishInFlight) return ensurePublishInFlight

	const run = async (): Promise<boolean> => {
		const { projectId, getWorkspaceFilesList, getWorkspaceFileTree, t } = options

		if (!projectId) {
			magicToast.error(t("skillEditPage.publishPanel.toast.publishNeedsProject"))
			return false
		}

		let files = getWorkspaceFilesList()
		if (files.length === 0) {
			await waitForAttachmentsListHydration(ATTACHMENTS_HYDRATION_MAX_MS)
			files = getWorkspaceFilesList()
		}

		const skillDir = pickLastModifiedSkillDirWithSkillMd(files)
		if (!skillDir) {
			magicToast.error(t("skillEditPage.publishPanel.toast.noValidSkillForPublish"))
			return false
		}

		if (findAttachmentByRelativePath(files, SKILL_CONFIG_RELATIVE_PATH)?.file_id) {
			return true
		}

		try {
			const parentId = await ensureFolderChain(
				projectId,
				MAGIC_SKILLS_FOLDER_SEGMENTS,
				files,
				getWorkspaceFileTree(),
			)

			const fileResponse = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: parentId,
				file_name: SKILL_CONFIG_FILE_NAME,
				is_directory: false,
			})

			if (!fileResponse?.file_id) throw new Error("createFileFailed")

			await SuperMagicApi.saveFileContent([
				{
					file_id: fileResponse.file_id,
					content: buildDefaultSkillConfigYaml(skillDir),
				},
			])

			pubsub.publish(PubSubEvents.Update_Attachments)
			return true
		} catch (error) {
			const errorObj = error as { code?: number; message?: string }
			if (errorObj?.code === 51168) {
				pubsub.publish(PubSubEvents.Update_Attachments)
				// 文件已存在
				return true
			}

			console.error("ensureSkillConfigYamlForPublish failed:", error)
			magicToast.error(t("skillEditPage.publishPanel.toast.ensureSkillConfigFailed"))
			return false
		}
	}

	const promise = run()
	ensurePublishInFlight = promise
	try {
		return await promise
	} finally {
		if (ensurePublishInFlight === promise) ensurePublishInFlight = null
	}
}
