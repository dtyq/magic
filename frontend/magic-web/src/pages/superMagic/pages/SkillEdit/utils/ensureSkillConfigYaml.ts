import type { TFunction } from "i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import {
	buildDefaultSkillConfigYaml,
	findAttachmentByRelativePath,
	findDirectoryIdByRelativePath,
	findDirectoryIdBySegmentWalk,
	pickLastModifiedSkillDirWithSkillMd,
	SKILL_CONFIG_FILE_NAME,
	SKILL_CONFIG_RELATIVE_PATH,
	SKILL_MD_FILE_NAME,
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

/** 将 skill 名称转换为文件系统安全的目录名 */
function toSkillDirName(raw: string): string {
	return raw
		.trim()
		.replace(/[\s/\\:*?"<>|]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
}

export async function ensureSkillConfigYamlForPublish(options: {
	projectId: string | undefined
	getWorkspaceFilesList: () => AttachmentItem[]
	getWorkspaceFileTree: () => AttachmentItem[]
	getSkillName?: () => string | undefined
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
			const skillDirName = toSkillDirName(options.getSkillName?.() ?? "")
			if (!skillDirName) {
				magicToast.error(t("skillEditPage.publishPanel.toast.noValidSkillForPublish"))
				return false
			}

			try {
				const skillsParentId = await ensureFolderChain(
					projectId,
					MAGIC_SKILLS_FOLDER_SEGMENTS,
					files,
					getWorkspaceFileTree(),
				)

				// 创建 skill 子目录 .magic/skills/<skillDirName>
				const skillDirRes = await SuperMagicApi.createFile({
					project_id: projectId,
					parent_id: skillsParentId,
					file_name: skillDirName,
					is_directory: true,
				})
				if (!skillDirRes?.file_id) throw new Error("createSkillDirFailed")

				// 在 skill 目录下创建 SKILL.md，传入 parentId
				const skillMdRes = await SuperMagicApi.createFile({
					project_id: projectId,
					parent_id: skillDirRes.file_id,
					file_name: SKILL_MD_FILE_NAME,
					is_directory: false,
				})
				if (!skillMdRes?.file_id) throw new Error("createSkillMdFailed")
				await SuperMagicApi.saveFileContent([{ file_id: skillMdRes.file_id, content: "" }])

				// 在 .magic/skills/ 下创建 skill_config.yaml，传入 parentId
				const configRes = await SuperMagicApi.createFile({
					project_id: projectId,
					parent_id: skillsParentId,
					file_name: SKILL_CONFIG_FILE_NAME,
					is_directory: false,
				})
				if (!configRes?.file_id) throw new Error("createFileFailed")
				await SuperMagicApi.saveFileContent([
					{
						file_id: configRes.file_id,
						content: buildDefaultSkillConfigYaml(skillDirName),
					},
				])

				pubsub.publish(PubSubEvents.Update_Attachments)
				return true
			} catch (error) {
				const errorObj = error as { code?: number; message?: string }
				if (errorObj?.code === SuperMagicApiErrorCode.DuplicateFile) {
					pubsub.publish(PubSubEvents.Update_Attachments)
					return true
				}
				console.error("ensureSkillConfigYamlForPublish failed:", error)
				magicToast.error(t("skillEditPage.publishPanel.toast.ensureSkillConfigFailed"))
				return false
			}
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
			if (errorObj?.code === SuperMagicApiErrorCode.DuplicateFile) {
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
