import type { AssetMediaType } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { Upload } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import type { TFunction } from "../../../public/i18n-types"
import { assetLibrarySessionStore } from "../../../runtime/resources/asset/AssetLibrarySessionStore"
import {
	getAssetUploadAccept,
	resolveUploadAssetMediaType,
	type AssetLibraryUploadMode,
} from "./assetLibraryMedia"

interface AssetLibraryUploadCardProps {
	allowedMediaTypes: readonly AssetMediaType[]
	t: TFunction
	seedanceComplianceAvailable?: boolean
	ensureAssetAgreementSigned?: (options?: { onSigned?: () => void }) => Promise<boolean>
	onAgreementActivityChange?: (active: boolean) => void
	onFileSelected: (file: File, mode: AssetLibraryUploadMode) => void
}

export function AssetLibraryUploadCard({
	allowedMediaTypes,
	t,
	seedanceComplianceAvailable = false,
	ensureAssetAgreementSigned,
	onAgreementActivityChange,
	onFileSelected,
}: AssetLibraryUploadCardProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const modeRef = useRef<AssetLibraryUploadMode>("save")
	const agreementSignedRef = useRef<boolean | null>(
		assetLibrarySessionStore.getCachedAssetAgreementSigned() ?? null,
	)
	const [preparingVerify, setPreparingVerify] = useState(false)
	const showImageFormats = allowedMediaTypes.includes("IMAGE")
	const showVideoFormats = allowedMediaTypes.includes("VIDEO")

	// 提前知道签署状态，已签署时可以在点击手势里直接打开文件选择器。
	useEffect(() => {
		if (agreementSignedRef.current === true) return
		let cancelled = false
		void assetLibrarySessionStore
			.getAssetAgreementSigned()
			.then((signed) => {
				if (!cancelled) agreementSignedRef.current = signed
			})
			.catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [])

	const openFilePicker = (mode: AssetLibraryUploadMode) => {
		modeRef.current = mode
		inputRef.current?.click()
	}

	const handlePick = (mode: AssetLibraryUploadMode) => {
		if (preparingVerify) return
		if (mode === "save") {
			openFilePicker("save")
			return
		}
		if (agreementSignedRef.current === true) {
			openFilePicker("verify")
			return
		}
		void prepareVerifiedUpload()
	}

	const prepareVerifiedUpload = async () => {
		setPreparingVerify(true)
		onAgreementActivityChange?.(true)
		try {
			if (!ensureAssetAgreementSigned) {
				toast.error(t("assets.agreementRequired", "请先签署 Seedance 系列模型使用承诺书"))
				return
			}
			let openedPicker = false
			const signed = await ensureAssetAgreementSigned({
				onSigned: () => {
					openedPicker = true
					agreementSignedRef.current = true
					assetLibrarySessionStore.markAssetAgreementSigned()
					openFilePicker("verify")
				},
			})
			if (!signed || openedPicker) return
			agreementSignedRef.current = true
			assetLibrarySessionStore.markAssetAgreementSigned()
			openFilePicker("verify")
		} catch {
			toast.error(t("assets.agreementRequired", "请先签署 Seedance 系列模型使用承诺书"))
		} finally {
			setPreparingVerify(false)
			onAgreementActivityChange?.(false)
		}
	}

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		event.target.value = ""
		if (!file) return

		const mediaType = resolveUploadAssetMediaType(file.name, allowedMediaTypes)
		if (!mediaType) {
			toast.error(t("assets.unsupportedFile", "暂不支持该文件类型"))
			return
		}
		onFileSelected(file, modeRef.current)
	}

	return (
		<div className="flex h-[320px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40 px-4 py-6 text-center">
			<input
				ref={inputRef}
				className="hidden"
				type="file"
				accept={getAssetUploadAccept(allowedMediaTypes)}
				onChange={handleFileChange}
			/>
			<div className="mb-3 flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground">
				<Upload className="size-5" />
			</div>
			<div className="text-base font-semibold leading-6">
				{t("assets.uploadTitle", "上传素材")}
			</div>
			<p className="mt-1 text-sm leading-5 text-muted-foreground">
				{t("assets.uploadDescription", "新增图片或视频记录")}
			</p>
			<div className="mt-4 flex w-full max-w-[220px] flex-col gap-2">
				<Button
					type="button"
					variant={seedanceComplianceAvailable ? "outline" : "default"}
					disabled={preparingVerify}
					onClick={() => handlePick("save")}
				>
					{t("assets.upload", "上传素材")}
				</Button>
				{seedanceComplianceAvailable ? (
					<Button
						type="button"
						disabled={preparingVerify}
						onClick={() => handlePick("verify")}
					>
						{t("assets.uploadAndVerify", "上传素材并认证")}
					</Button>
				) : null}
			</div>
			<div className="mt-4 space-y-1 text-xs leading-5 text-muted-foreground">
				{showImageFormats ? (
					<p>
						{t(
							"assets.uploadFormatsImage",
							"图片：jpeg、png、webp、bmp、tiff、gif、heic、heif",
						)}
					</p>
				) : null}
				{showVideoFormats ? (
					<p>{t("assets.uploadFormatsVideo", "视频：mp4、mov")}</p>
				) : null}
			</div>
		</div>
	)
}
