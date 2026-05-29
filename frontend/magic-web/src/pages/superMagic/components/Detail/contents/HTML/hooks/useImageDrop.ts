/**
 * useImageDrop
 * Hook that handles dragging images (from file list or external system)
 * into the HTML iframe editor. Only active in edit mode.
 *
 * For file list items: calculates relative path and inserts directly.
 * For external files: uploads via uploadImageFileToProject then inserts.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import magicToast from "@/components/base/MagicToaster/utils"
import {
    DRAG_TYPE,
    PROJECT_ATTACHMENT_DRAG_MIME,
    PROJECT_IMAGE_ATTACHMENT_DRAG_MIME,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"])

function isImageFile(fileName: string): boolean {
    const ext = fileName.split(".").pop()?.toLowerCase() || ""
    return IMAGE_EXTENSIONS.has(ext)
}

/**
 * Compute the relative path from the current HTML file to the target file.
 * Both paths are project-absolute (e.g., "/folder/sub/file.html" and "/images/pic.png").
 */
function computeRelativePath(fromFilePath: string, toFilePath: string): string {
    // Normalize: ensure paths start with /
    const from = fromFilePath.startsWith("/") ? fromFilePath : `/${fromFilePath}`
    const to = toFilePath.startsWith("/") ? toFilePath : `/${toFilePath}`

    // Get directory of the "from" file
    const fromParts = from.split("/")
    fromParts.pop() // remove filename
    const toParts = to.split("/")

    // Find common prefix length
    let commonLength = 0
    const minLen = Math.min(fromParts.length, toParts.length - 1)
    for (let i = 0; i < minLen; i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength = i + 1
        } else {
            break
        }
    }

    // Build relative path
    const upCount = fromParts.length - commonLength
    const downParts = toParts.slice(commonLength)

    const parts: string[] = []
    if (upCount === 0) {
        parts.push(".")
    } else {
        for (let i = 0; i < upCount; i++) {
            parts.push("..")
        }
    }
    parts.push(...downParts)

    return parts.join("/")
}

interface UseImageDropOptions {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
    isEditMode?: boolean
    scaleRatio: number
    relative_file_path?: string
    attachmentList?: AttachmentItem[]
    filePathMapping: Map<string, string>
    uploadImageFileToProject: (params: {
        file: File
        path: string
        fileSize?: number
        parentId?: string
    }) => Promise<{ storedRelativeFilePath: string }>
    onUploadSuccess?: () => void
    /** Target origin for postMessage to iframe. Use specific origin for cross-origin sandbox, "*" for same-origin. */
    targetOrigin?: string
}

interface UseImageDropReturn {
    isDragOver: boolean
    isGlobalDragActive: boolean
    dragOverHandlers: {
        onDragEnter: (e: React.DragEvent) => void
        onDragOver: (e: React.DragEvent) => void
        onDragLeave: (e: React.DragEvent) => void
        onDrop: (e: React.DragEvent) => void
    }
}

export function useImageDrop(options: UseImageDropOptions): UseImageDropReturn {
    const {
        iframeRef,
        isEditMode,
        scaleRatio,
        relative_file_path,
        attachmentList,
        filePathMapping,
        uploadImageFileToProject,
        onUploadSuccess,
        targetOrigin = "*",
    } = options

    const { t } = useTranslation("super")
    const [isDragOver, setIsDragOver] = useState(false)
    const dragEnterCounter = useRef(0)
    const projectFilePreviewUrlCache = useRef<Map<string, string>>(new Map())
    // Track whether a global drag is happening (any drag in the document)
    const [isGlobalDragActive, setIsGlobalDragActive] = useState(false)

    // Listen for global drag events to detect when any drag starts.
    // This enables the overlay's pointer-events before the cursor reaches the iframe.
    useEffect(() => {
        if (!isEditMode) return

        let globalDragEnterCount = 0

        const handleDocumentDragEnter = (event: DragEvent) => {
            if (!hasDragImageData(event.dataTransfer)) return
            globalDragEnterCount++
            setIsGlobalDragActive(true)
        }

        const handleDocumentDragOverCapture = (event: DragEvent) => {
            const canHandleDragData = hasDragImageData(event.dataTransfer)
            if (canHandleDragData) {
                setIsGlobalDragActive(true)
            }
        }

        const handleDocumentDragLeave = () => {
            globalDragEnterCount--
            if (globalDragEnterCount <= 0) {
                globalDragEnterCount = 0
                setIsGlobalDragActive(false)
                setIsDragOver(false)
                dragEnterCounter.current = 0
            }
        }

        const handleDocumentDrop = () => {
            globalDragEnterCount = 0
            setIsGlobalDragActive(false)
        }

        const handleDocumentDragEnd = () => {
            globalDragEnterCount = 0
            setIsGlobalDragActive(false)
            setIsDragOver(false)
            dragEnterCounter.current = 0
        }

        document.addEventListener("dragenter", handleDocumentDragEnter)
        document.addEventListener("dragover", handleDocumentDragOverCapture, true)
        document.addEventListener("dragleave", handleDocumentDragLeave)
        document.addEventListener("drop", handleDocumentDrop)
        document.addEventListener("dragend", handleDocumentDragEnd)

        return () => {
            document.removeEventListener("dragenter", handleDocumentDragEnter)
            document.removeEventListener("dragover", handleDocumentDragOverCapture, true)
            document.removeEventListener("dragleave", handleDocumentDragLeave)
            document.removeEventListener("drop", handleDocumentDrop)
            document.removeEventListener("dragend", handleDocumentDragEnd)
        }
    }, [
        attachmentList?.length,
        filePathMapping.size,
        iframeRef,
        isEditMode,
        relative_file_path,
        scaleRatio,
    ])

    /**
     * Check if the drag event contains image data we can handle.
     */
    const hasImageData = useCallback((e: React.DragEvent): boolean => {
        const types = e.dataTransfer.types

        // External file: check for Files type
        if (types.includes("Files")) {
            return hasExternalImageFileData(e.dataTransfer)
        }

        // File list drag: only project image files can enter image drop preview.
        if (types.includes(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME)) {
            return true
        }

        return false
    }, [])

    /**
     * Parse file list drag data and check if it's an image file.
     */
    const parseFileListDragData = useMemoizedFn(
        (
            e: React.DragEvent,
        ): { isImage: boolean; item?: AttachmentItem; relativePath?: string } | null => {
            const plainText =
                e.dataTransfer.getData(PROJECT_ATTACHMENT_DRAG_MIME) ||
                e.dataTransfer.getData("text/plain")
            if (!plainText) return null

            try {
                const parsed = JSON.parse(plainText)

                // Single file drag
                if (parsed.type === DRAG_TYPE.ProjectFile && parsed.data) {
                    const item = parsed.data as AttachmentItem
                    const fileName = item.file_name || item.name || ""
                    if (!isImageFile(fileName)) {
                        return { isImage: false }
                    }

                    // Compute relative path from current HTML to this image
                    const imageAbsPath = item.relative_file_path
                    if (!imageAbsPath || !relative_file_path) {
                        return { isImage: false }
                    }

                    const relPath = computeRelativePath(relative_file_path, imageAbsPath)
                    return { isImage: true, item, relativePath: relPath }
                }

                // Multiple files drag - take first image
                if (parsed.type === DRAG_TYPE.MultipleFiles && Array.isArray(parsed.data)) {
                    const firstImage = (parsed.data as AttachmentItem[]).find((item) => {
                        const fileName = item.file_name || item.name || ""
                        return isImageFile(fileName) && item.relative_file_path
                    })
                    if (!firstImage || !relative_file_path) {
                        return { isImage: false }
                    }
                    const relPath = computeRelativePath(
                        relative_file_path,
                        firstImage.relative_file_path!,
                    )
                    return { isImage: true, item: firstImage, relativePath: relPath }
                }
            } catch {
                // Not JSON, ignore
            }

            return null
        },
    )

    /**
     * Send coordinates to iframe for drop position indicator.
     */
    const sendDragOverToIframe = useMemoizedFn((e: React.DragEvent) => {
        const iframe = iframeRef.current
        if (!iframe) return

        const iframeRect = iframe.getBoundingClientRect()
        const x = (e.clientX - iframeRect.left) / scaleRatio
        const y = (e.clientY - iframeRect.top) / scaleRatio

        iframe.contentWindow?.postMessage(
            {
                type: "DRAG_OVER_IMAGE",
                data: { x, y },
            },
            targetOrigin,
        )
    })

    /**
     * Notify iframe to hide indicator.
     */
    const sendDragLeaveToIframe = useMemoizedFn(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        iframe.contentWindow?.postMessage(
            {
                type: "DRAG_LEAVE_IMAGE",
                data: {},
            },
            targetOrigin,
        )
    })

    /**
     * Get the preview URL for a file from filePathMapping.
     */
    const getPreviewUrl = useMemoizedFn((relativePath: string): string | undefined => {
        // filePathMapping maps relative_file_path → CDN URL
        // Try both with and without leading slash
        const withSlash = relativePath.startsWith("/") ? relativePath : `/${relativePath}`
        const withoutSlash = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath

        return filePathMapping.get(withSlash) || filePathMapping.get(withoutSlash)
    })

    const resolveProjectFilePreviewUrl = useMemoizedFn(
        async (item?: AttachmentItem): Promise<string | undefined> => {
            if (!item?.file_id) return undefined
            const cachedUrl = projectFilePreviewUrlCache.current.get(item.file_id)
            if (cachedUrl) return cachedUrl

            const urls = await getTemporaryDownloadUrl({ file_ids: [item.file_id] })
            const url = urls?.[0]?.url
            if (url) {
                projectFilePreviewUrlCache.current.set(item.file_id, url)
                return url
            }

            return undefined
        },
    )

    const onDragEnter = useMemoizedFn((e: React.DragEvent) => {
        if (!isEditMode) return
        const canHandleImageData = hasImageData(e)
        if (!canHandleImageData) return

        e.preventDefault()
        e.stopPropagation()
        dragEnterCounter.current++
        setIsDragOver(true)
    })

    const onDragOver = useMemoizedFn((e: React.DragEvent) => {
        if (!isEditMode) return
        const canHandleImageData = hasImageData(e)
        if (!canHandleImageData) return

        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "copy"

        if (!isDragOver) setIsDragOver(true)
        sendDragOverToIframe(e)
    })

    const onDragLeave = useMemoizedFn((e: React.DragEvent) => {
        if (!isEditMode) return

        e.preventDefault()
        e.stopPropagation()
        dragEnterCounter.current--

        if (dragEnterCounter.current <= 0) {
            dragEnterCounter.current = 0
            setIsDragOver(false)
            sendDragLeaveToIframe()
        }
    })

    const onDrop = useMemoizedFn(async (e: React.DragEvent) => {
        if (!isEditMode) return

        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        setIsGlobalDragActive(false)
        dragEnterCounter.current = 0

        const iframe = iframeRef.current
        if (!iframe) return

        const iframeRect = iframe.getBoundingClientRect()
        const x = (e.clientX - iframeRect.left) / scaleRatio
        const y = (e.clientY - iframeRect.top) / scaleRatio

        // Try file list drag first
        const fileListData = parseFileListDragData(e)
        if (fileListData?.isImage && fileListData.relativePath) {
            // File list item: compute relative path and insert directly
            const mappedPreviewUrl = fileListData.item?.relative_file_path
                ? getPreviewUrl(fileListData.item.relative_file_path)
                : undefined
            const previewUrl =
                mappedPreviewUrl || (await resolveProjectFilePreviewUrl(fileListData.item))

            iframe.contentWindow?.postMessage(
                {
                    type: "DROP_IMAGE",
                    data: {
                        relativePath: fileListData.relativePath,
                        previewUrl: previewUrl || fileListData.relativePath,
                        x,
                        y,
                    },
                },
                targetOrigin,
            )

            sendDragLeaveToIframe()
            return
        }

        // External file drop
        const files = e.dataTransfer.files
        if (files.length > 0) {
            const file = files[0]
            if (!file.type.startsWith("image/")) {
                sendDragLeaveToIframe()
                return
            }

            try {
                magicToast.loading({
                    content: t("topicFiles.fileUploading"),
                    duration: 0,
                })

                // Convert to base64 for immediate preview
                const previewUrl = await fileToBase64(file)

                // Upload the file
                const uploadResult = await uploadImageFileToProject({
                    file,
                    path: `./images/${file.name}`,
                    fileSize: file.size,
                })

                // Send insertion command to iframe
                iframe.contentWindow?.postMessage(
                    {
                        type: "DROP_IMAGE",
                        data: {
                            relativePath: uploadResult.storedRelativeFilePath,
                            previewUrl,
                            x,
                            y,
                        },
                    },
                    targetOrigin,
                )

                magicToast.destroy()
                magicToast.success(t("topicFiles.fileUploadSuccess"))
                onUploadSuccess?.()
            } catch (error) {
                console.error("Failed to upload dropped image:", error)
                magicToast.destroy()
                magicToast.error(t("topicFiles.fileUploadError", "文件上传失败"))
            }

            sendDragLeaveToIframe()
            return
        }

        sendDragLeaveToIframe()
    })

    return {
        isDragOver,
        isGlobalDragActive,
        dragOverHandlers: {
            onDragEnter,
            onDragOver,
            onDragLeave,
            onDrop,
        },
    }
}

/**
 * Convert a File to a base64 data URL.
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("File read failed"))
        reader.readAsDataURL(file)
    })
}

function hasDragImageData(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) return false
    const types = Array.from(dataTransfer.types)
    return (
        types.includes(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME) ||
        (types.includes("Files") && hasExternalImageFileData(dataTransfer))
    )
}

function hasExternalImageFileData(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) return false

    const items = Array.from(dataTransfer.items ?? [])
    if (items.length > 0) {
        // During dragenter/dragover, some browsers hide item.type for security.
        // If there are file items with empty type, assume they could be images
        // (actual type check happens at drop time).
        return items.some(
            (item) => item.kind === "file" && (item.type === "" || item.type.startsWith("image/")),
        )
    }

    const files = Array.from(dataTransfer.files ?? [])
    if (files.length > 0) {
        return files.some((file) => file.type.startsWith("image/") || isImageFile(file.name))
    }

    return false
}
