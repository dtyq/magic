import {
	findMagicProjectJsFile,
	parseMagicProjectJsContent,
	getDesignDirectoryInfo,
	replaceNameInMagicProjectJsContent,
} from "../utils/utils"
import { SuperMagicApi } from "@/opensource/apis"
import type { DesignProjectStateBag, DesignProjectManagerOptions } from "./types"

export class DesignLoadManager {
	private stateBag: DesignProjectStateBag
	private options: DesignProjectManagerOptions

	private isLoading = false
	private lastLoadedFileId: string | null = null
	private currentProjectId: string | null = null

	constructor(stateBag: DesignProjectStateBag, options: DesignProjectManagerOptions) {
		this.stateBag = stateBag
		this.options = options
	}

	updateOptions(options: DesignProjectManagerOptions) {
		this.options = options
	}

	async loadFromRemote(): Promise<void> {
		const {
			currentFile,
			attachments,
			flatAttachments,
			projectId,
			allowEdit,
			isPlaybackMode,
			isShareRoute,
			isMobile,
		} = this.options

		let actualCurrentFileId = currentFile?.id
		let actualCurrentFileName = currentFile?.name

		if (!actualCurrentFileId && actualCurrentFileName && (flatAttachments?.length ?? 0) > 0) {
			const foundDirectory = flatAttachments?.find(
				(item) =>
					item.is_directory &&
					(item.file_name === actualCurrentFileName ||
						item.display_filename === actualCurrentFileName),
			)
			if (foundDirectory) {
				actualCurrentFileId = foundDirectory.file_id
				actualCurrentFileName =
					foundDirectory.file_name ||
					foundDirectory.display_filename ||
					actualCurrentFileName
			}
		}

		if (!actualCurrentFileId || !actualCurrentFileName || !attachments) {
			this.stateBag.setters.setIsInitialLoading(false)
			return
		}

		const currentProjectId = projectId ?? null
		const hasProjectChanged =
			this.currentProjectId !== null && this.currentProjectId !== currentProjectId

		if (hasProjectChanged) {
			this.lastLoadedFileId = null
			this.stateBag.setters.setIsReadOnly(
				!allowEdit || isPlaybackMode || isShareRoute || isMobile,
			)
		}

		this.currentProjectId = currentProjectId

		if (this.isLoading) return
		if (this.lastLoadedFileId === actualCurrentFileId && !hasProjectChanged) return

		try {
			this.isLoading = true
			this.stateBag.setters.setIsInitialLoading(true)

			const result = await findMagicProjectJsFile({
				attachments,
				currentFileId: actualCurrentFileId,
				currentFileName: actualCurrentFileName,
			})

			if (result?.fileId) {
				this.stateBag.setters.setMagicProjectJsFileId(result.fileId)

				if (result.content) {
					const parsedData = parseMagicProjectJsContent(result.content)
					if (parsedData) {
						const directoryInfo = getDesignDirectoryInfo(
							{ id: actualCurrentFileId, name: actualCurrentFileName },
							attachments,
						)

						if (
							directoryInfo.name &&
							parsedData.name &&
							directoryInfo.name !== parsedData.name
						) {
							try {
								const updatedContent = replaceNameInMagicProjectJsContent(
									result.content,
									parsedData.name,
									directoryInfo.name,
								)
								if (allowEdit && !isPlaybackMode && !isShareRoute && !isMobile) {
									await SuperMagicApi.saveFileContent([
										{
											file_id: result.fileId,
											content: updatedContent,
											enable_shadow: true,
										},
									])
								}
								parsedData.name = directoryInfo.name
							} catch {
								parsedData.name = directoryInfo.name
							}
						}

						this.stateBag.setters.setDesignData(parsedData)
						this.lastLoadedFileId = actualCurrentFileId
					}
				}

				if (!isShareRoute) {
					try {
						const fileInfo = await SuperMagicApi.getFileInfo({
							file_id: result.fileId,
						})
						if (fileInfo?.version !== undefined) {
							this.stateBag.setMagicProjectJsVersion(fileInfo.version)
						}
					} catch {
						// ignore
					}
				}
			}
		} catch {
			// ignore
		} finally {
			this.isLoading = false
			this.stateBag.setters.setIsInitialLoading(false)
		}
	}

	async resetAndReload(): Promise<void> {
		this.lastLoadedFileId = null
		await this.loadFromRemote()
	}
}
