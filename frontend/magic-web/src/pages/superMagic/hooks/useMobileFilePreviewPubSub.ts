import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getFileType, downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

interface UseMobileFilePreviewPubSubOptions {
    /** 附件扁平列表，用于按 ID / 路径查找文件 */
    attachmentList: AttachmentItem[]
    /** 打开预览弹窗（传入构造好的 detail 对象） */
    setUserSelectDetail: (detail: any) => void
    /** 通过文件项打开预览（传入 attachmentItem 或 { file_id, file_name } 等） */
    onFileClick: (fileItem?: unknown) => void
    /** 处理话题回放节点文件打开（可选，传入 toolData） */
    onPlaybackOpen?: (data: unknown) => void
}

/**
 * 移动端统一订阅消息节点中的文件预览 / 路径打开 / 话题回放 pubsub 事件。
 *
 * 适用于不通过 `useTopicDetailPanelController`（桌面端）处理这些事件的移动端页面。
 */
export function useMobileFilePreviewPubSub({
    attachmentList,
    setUserSelectDetail,
    onFileClick,
    onPlaybackOpen,
}: UseMobileFilePreviewPubSubOptions) {
    // 订阅消息节点中的文件预览事件
    useEffect(() => {
        const handleOpenFileTab = (data: { fileId?: string; fileData?: any }) => {
            const filePayload = data?.fileData
            const fileId = filePayload?.file_id || data?.fileId

            if (filePayload) {
                if (!fileId) return
                setUserSelectDetail({
                    type: getFileType(filePayload?.file_extension || ""),
                    data: {
                        ...filePayload,
                        file_id: fileId,
                        file_name: filePayload?.file_name || filePayload?.display_filename || "",
                    },
                    currentFileId: fileId,
                })
                return
            }

            if (!fileId) return
            const targetFile = attachmentList.find((item) => item.file_id === fileId)
            if (targetFile) {
                onFileClick(targetFile)
            } else {
                onFileClick({ file_id: fileId })
            }
        }

        pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)

        return () => {
            pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
        }
    }, [attachmentList, setUserSelectDetail, onFileClick])

    // 订阅消息节点中的文件路径打开事件
    useEffect(() => {
        const handleOpenFileTabByPath = (data: unknown) => {
            const payload = data as {
                filePath: string
                fileName: string
                action?: "open" | "download"
            }
            const normPath = (p: string) => p.replace(/^\//, "")
            const targetPath = normPath(payload.filePath)
            const matched = attachmentList.find(
                (item) =>
                    !item.is_directory && normPath(item.relative_file_path || "") === targetPath,
            )
            if (!matched?.file_id) return

            if (payload.action === "download") {
                getTemporaryDownloadUrl({
                    file_ids: [matched.file_id],
                    is_download: true,
                }).then((res: any) => {
                    downloadFileWithAnchor(res[0]?.url)
                })
            } else {
                onFileClick({
                    file_id: matched.file_id,
                    file_name: matched.file_name || payload.fileName,
                })
            }
        }

        pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)

        return () => {
            pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
        }
    }, [attachmentList, onFileClick])

    // 订阅消息节点中的话题回放事件
    useEffect(() => {
        if (!onPlaybackOpen) return

        const handleOpenPlaybackTab = (data: unknown) => {
            onPlaybackOpen(data)
        }

        pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)

        return () => {
            pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
        }
    }, [onPlaybackOpen])
}
