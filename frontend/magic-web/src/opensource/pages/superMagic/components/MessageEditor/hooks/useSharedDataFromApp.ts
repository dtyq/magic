import { useEffect, useRef } from "react"
import { getNativePort } from "@/opensource/platform/native"
import { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import { logger as Logger } from "@/opensource/utils/log"
import StreamChunkManager from "../services/streamChunkManager"
import { base64ToFile, extractFileNameFromPath } from "../utils/fileConverter"
import { TopicMode } from "../../../pages/Workspace/types"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"

const logger = Logger.createLogger("useSharedDataFromApp")

interface UseSharedDataFromAppProps {
	editor: Editor | null
	addFiles: (files: File[], path?: string) => void
	uploadEnabled: boolean
}

function useSharedDataFromApp({ editor, addFiles, uploadEnabled }: UseSharedDataFromAppProps) {
	const { t } = useTranslation("super")
	const chunkManagerRef = useRef<StreamChunkManager | null>(null)

	useEffect(() => {
		// Initialize chunk manager
		if (!chunkManagerRef.current) {
			chunkManagerRef.current = new StreamChunkManager({ timeout: 30000 })
		}

		const chunkManager = chunkManagerRef.current

		try {
			const destroy = getNativePort().sharing.observeReceivedSharedData(async (data) => {
				console.log("received shared data from app", {
					...data.stream,
					base64_data: data.stream?.base64_data?.slice(0, 100) + "...",
				})

				try {
					if (
						data.project_mode &&
						superMagicModeService.isModeValid(data.project_mode as TopicMode)
					) {
						pubsub.publish(PubSubEvents.Super_Magic_Receive_Shared_Project_Mode, {
							mode: data.project_mode as TopicMode,
						})
					}

					// Handle text content
					if (data.type === 2 && data.content) {
						logger.log("Inserting text content", data.content)
						editor?.chain().insertContent(data.content).focus().run()
						return
					}

					// Handle file sharing with streaming
					if (data.type === 1 && data.stream) {
						if (!uploadEnabled) {
							logger.log("File sharing ignored because upload module is disabled")
							return
						}

						const { file_index, file_path, stream_status, base64_data, chunk_id } =
							data.stream

						try {
							// Set file path on first chunk
							if (stream_status === 0) {
								chunkManager.setFilePath(file_index, file_path)
							}

							// Add chunk to manager
							chunkManager.addChunk(file_index, chunk_id, base64_data, stream_status)

							// Process completed file
							if (stream_status === 2 && chunkManager.isFileComplete(file_index)) {
								const mergedBase64 = chunkManager.getMergedBase64(file_index)
								const storedFilePath = chunkManager.getFilePath(file_index)

								if (!mergedBase64) {
									throw new Error("Failed to merge file chunks")
								}

								// Extract file name from path
								const fileName = extractFileNameFromPath(
									storedFilePath || file_path,
								)
								logger.log(`Processing completed file: ${fileName}`)

								// Convert base64 to File
								const file = base64ToFile(mergedBase64, fileName)

								// Upload file
								addFiles([file])

								// Clean up
								chunkManager.clearFile(file_index)

								logger.log(`File ${fileName} processed successfully`)
							}
						} catch (error) {
							logger.error("Error processing file stream", error)
							magicToast.error(
								t("sharedData.error.fileProcessFailed", "文件处理失败，请重试"),
							)
							// Clean up on error
							chunkManager.clearFile(file_index)
						}
					}
				} catch (error) {
					logger.error("Error handling shared data", error)
					magicToast.error(t("sharedData.error.processFailed", "数据处理失败"))
				}
			})

			getNativePort().sharing.readyForSuperMagic({})

			return () => {
				destroy?.(true)
				// Clean up chunk manager
				chunkManagerRef.current?.clearAll()
			}
		} catch (error) {
			logger.error("error", error)
		}
	}, [editor, addFiles, t, uploadEnabled])
}

export default useSharedDataFromApp
