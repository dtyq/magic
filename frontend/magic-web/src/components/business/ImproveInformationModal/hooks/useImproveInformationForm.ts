import { useMemoizedFn } from "ahooks"
import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useUpload } from "@/hooks/useUploadFiles"
import type { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import magicToast from "@/components/base/MagicToaster/utils"
import type { ImproveInformationData } from "../types"

interface UseImproveInformationFormOptions {
	onSubmit?: (data: ImproveInformationData) => void | Promise<void>
	onSuccess?: () => void
}

export function useImproveInformationForm({
	onSubmit,
	onSuccess,
}: UseImproveInformationFormOptions = {}) {
	const { t } = useTranslation("interface")

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "public",
	})

	const [imagePreviewUrl, setImagePreviewUrl] = useState<string>()
	const [imageUploadUrl, setImageUploadUrl] = useState<string>()
	const [imageUploadKey, setImageUploadKey] = useState<string>()
	const [userName, setUserName] = useState("")
	const [professionalIdentity, setProfessionalIdentity] = useState<string | undefined>(undefined)
	const [discoveryChannel, setDiscoveryChannel] = useState<string | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const dragCounterRef = useRef(0)

	const isDisabled = useMemo(() => !userName || isLoading, [userName, isLoading])

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		const localPreviewUrl = URL.createObjectURL(fileList[0])
		const newFiles = Array.from(fileList).map(genFileData)
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { path, url } = fullfilled[0].value
			setImagePreviewUrl(localPreviewUrl)
			setImageUploadUrl(url)
			setImageUploadKey(path)
		} else {
			magicToast.error(t("file.uploadFail", { ns: "message" }))
		}
	})

	const handleDragEnter = useMemoizedFn((e: React.DragEvent) => {
		e.preventDefault()
		dragCounterRef.current += 1
		if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true)
	})

	const handleDragLeave = useMemoizedFn((e: React.DragEvent) => {
		e.preventDefault()
		dragCounterRef.current -= 1
		if (dragCounterRef.current === 0) setIsDragging(false)
	})

	const handleDragOver = useMemoizedFn((e: React.DragEvent) => {
		e.preventDefault()
	})

	const handleDrop = useMemoizedFn((e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
		dragCounterRef.current = 0
		const { files } = e.dataTransfer
		if (files && files.length > 0) onFileChange(files)
	})

	const handleSubmit = useMemoizedFn(async () => {
		if (isDisabled) return
		setIsLoading(true)
		try {
			await onSubmit?.({
				userName,
				avatarUrl: imageUploadUrl,
				avatarKey: imageUploadKey,
				profession: professionalIdentity,
				channel: discoveryChannel,
			})
			onSuccess?.()
		} catch (error) {
			console.error("Submit error:", error)
		} finally {
			setIsLoading(false)
		}
	})

	const reset = useMemoizedFn(() => {
		setImagePreviewUrl(undefined)
		setImageUploadUrl(undefined)
		setImageUploadKey(undefined)
		setUserName("")
		setProfessionalIdentity(undefined)
		setDiscoveryChannel(undefined)
		setIsLoading(false)
		setIsDragging(false)
		dragCounterRef.current = 0
	})

	return {
		// state
		uploading,
		imagePreviewUrl,
		userName,
		setUserName,
		professionalIdentity,
		setProfessionalIdentity,
		discoveryChannel,
		setDiscoveryChannel,
		isLoading,
		isDisabled,
		isDragging,
		// handlers
		onFileChange,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		handleSubmit,
		reset,
	}
}
