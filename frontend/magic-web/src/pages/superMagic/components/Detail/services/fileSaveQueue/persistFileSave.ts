import { SuperMagicApi } from "@/apis"
import type { FileScope } from "@/apis/modules/fileScope"
import { ossUploadService } from "@/stores/folderUpload/uploadService"
import { unshadow } from "@/utils/shadow"
import {
	FileSaveConflictError,
	FileSavePermanentError,
	FileSaveRetryableError,
	type FileSavePersistRequest,
	type FileSavePersistResult,
} from "./types"
import { getErrorStatus } from "./FileSaveQueue"

export interface PersistFileSaveMeta {
	fileKey?: string
	fileName?: string
	projectId?: string
	fileScope?: FileScope
}

export interface PersistFileSaveContext {
	getFileMeta: (fileId: string) => PersistFileSaveMeta
	syncFolderName?: (fileId: string, content: unknown) => Promise<void>
}

export async function assertRemoteBaseline(
	fileId: string,
	baselineVersion?: string,
): Promise<void> {
	if (!baselineVersion) return
	const info = await SuperMagicApi.getFileInfo(
		{ file_id: fileId },
		{ enableErrorMessagePrompt: false },
	)
	const remoteVersion = info?.version != null ? String(info.version) : undefined
	if (remoteVersion && remoteVersion !== String(baselineVersion)) {
		throw new FileSaveConflictError()
	}
}

async function readRemoteVersion(fileId: string): Promise<string | undefined> {
	try {
		const info = await SuperMagicApi.getFileInfo(
			{ file_id: fileId },
			{ enableErrorMessagePrompt: false },
		)
		return info?.version != null ? String(info.version) : undefined
	} catch {
		return undefined
	}
}

export function normalizePersistError(error: unknown): Error {
	if (error instanceof FileSaveConflictError || error instanceof FileSavePermanentError) {
		return error
	}
	const status = getErrorStatus(error)
	if (status === 409) return new FileSaveConflictError()
	if (status === 401 || status === 403 || status === 404) {
		return new FileSavePermanentError(
			error instanceof Error ? error.message : "File save is not retryable",
		)
	}
	return error instanceof Error ? error : new Error(String(error))
}

/** Upload edited content, then commit via replaceFile or saveFileContent. */
export async function persistFileSave(
	request: FileSavePersistRequest,
	context: PersistFileSaveContext,
): Promise<FileSavePersistResult> {
	try {
		if (!request.forceOverwrite) {
			await assertRemoteBaseline(request.fileId, request.baselineVersion)
		}
		try {
			await context.syncFolderName?.(request.fileId, request.content)
		} catch (error) {
			console.error("syncCustomProjectFolderNameBeforeSave failed:", error)
		}

		const meta = context.getFileMeta(request.fileId)
		const contentStr =
			typeof request.content === "string" ? request.content : JSON.stringify(request.content)
		// 解码器统一处理版本及无前缀正文，避免持久化层重复判断协议。
		const uploadContent = request.enableShadow ? unshadow(contentStr) : contentStr

		if (meta.fileKey && meta.projectId) {
			const uploadedPath = await ossUploadService.uploadContentByFileKey(
				uploadContent,
				meta.fileKey,
				meta.projectId,
				meta.fileName || "content.html",
				meta.fileScope,
			)
			await SuperMagicApi.replaceFile({
				id: request.fileId,
				file_key: uploadedPath,
			})
			// Only needed to rebase a queued follow-up save that started from this baseline.
			return {
				version: request.baselineVersion
					? await readRemoteVersion(request.fileId)
					: undefined,
			}
		}

		const res = await SuperMagicApi.saveFileContent([
			{
				file_id: request.fileId,
				content: request.content,
				enable_shadow: request.enableShadow,
			},
		])
		const saved = res?.success_files?.[0]
		if (!saved) {
			// An empty result may be a transient gateway or backend fault, so let the queue retry.
			const reason = res?.error_files?.[0]?.error
			throw new FileSaveRetryableError(
				reason
					? `Save API rejected the file: ${reason}`
					: "Save API returned no success files",
			)
		}
		const version = saved.data?.version
		return { version: version != null ? String(version) : undefined }
	} catch (error) {
		throw normalizePersistError(error)
	}
}
