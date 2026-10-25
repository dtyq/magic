import { useRef, useState, type ReactNode } from "react"
import { Dropdown } from "antd"
import { Download, LoaderCircle, Maximize2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import magicToast from "@/components/base/MagicToaster/utils"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useDownloadImageMenu } from "@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu"
import { MediaPreviewImageDialog } from "./MediaPreviewImageDialog"
import type { MediaPreviewTooltipProps } from "./types"

interface Props extends Pick<
	MediaPreviewTooltipProps,
	"fileName" | "resourceKey" | "imageActions" | "crop" | "sourceSize" | "container"
> {
	onExpand: () => void
	getTrigger: () => HTMLElement | null
	children: (controls: ReactNode, modalOpen: boolean, menuOpen: boolean) => ReactNode
}

/** 菜单、协议和大图都是小预览的兄弟，离开悬停区域不会取消已发起的操作。 */
export function MediaPreviewImageActions({
	fileName,
	resourceKey,
	imageActions,
	crop,
	sourceSize,
	container,
	onExpand,
	getTrigger,
	children,
}: Props) {
	const { t } = useTranslation("super")
	const { permissions } = useFileAccess()
	const permissionsRef = useRef(permissions)
	permissionsRef.current = permissions
	const [modalOpen, setModalOpen] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const [downloading, setDownloading] = useState(false)
	const downloadingRef = useRef(false)
	const restoreTargetRef = useRef<HTMLElement | null>(null)
	const onDownload: NonNullable<typeof imageActions>["onDownload"] =
		permissions.download && imageActions?.onDownload
			? async (mode) => {
					if (downloadingRef.current || !permissionsRef.current.download) return
					downloadingRef.current = true
					setDownloading(true)
					try {
						await imageActions.onDownload?.(mode)
					} catch {
						magicToast.error(t("filePreview.downloadFailed"))
					} finally {
						downloadingRef.current = false
						setDownloading(false)
					}
				}
			: undefined
	const { agreementModal, downloadImageDropdownItems, downloadMenuClick } = useDownloadImageMenu({
		onDownload,
	})
	const buttonClass =
		"inline-flex size-7 shrink-0 items-center justify-center rounded bg-black/50 text-white hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
	const downloadButton = (
		<button
			type="button"
			className={buttonClass}
			disabled={downloading}
			aria-label={t("filePreview.downloadImage")}
			onClick={imageActions?.isAIImage ? undefined : () => void onDownload?.()}
		>
			{downloading ? (
				<LoaderCircle size={16} className="animate-spin" />
			) : (
				<Download size={16} />
			)}
		</button>
	)
	const controls = imageActions ? (
		<div className="flex shrink-0 items-center gap-1">
			{onDownload &&
				(imageActions.isAIImage ? (
					<Dropdown
						open={menuOpen}
						onOpenChange={setMenuOpen}
						trigger={["click"]}
						placement="bottomRight"
						getPopupContainer={() => container ?? document.body}
						menu={{
							items: downloadImageDropdownItems,
							onClick: (event) => {
								setMenuOpen(false)
								downloadMenuClick(event)
							},
						}}
					>
						{downloadButton}
					</Dropdown>
				) : (
					<MagicTooltip title={t("filePreview.downloadImage")}>
						{downloadButton}
					</MagicTooltip>
				))}
			<MagicTooltip title={t("filePreview.expandImage")}>
				<button
					type="button"
					className={buttonClass}
					aria-label={t("filePreview.expandImage")}
					onClick={() => {
						const trigger = getTrigger()
						restoreTargetRef.current = trigger?.matches("button, a, [tabindex]")
							? trigger
							: (trigger?.closest<HTMLElement>('[contenteditable="true"]') ?? null)
						onExpand()
						setModalOpen(true)
					}}
				>
					<Maximize2 size={16} />
				</button>
			</MagicTooltip>
		</div>
	) : null

	return (
		<>
			{children(controls, modalOpen, menuOpen)}
			{modalOpen && imageActions && (
				<MediaPreviewImageDialog
					fileName={fileName}
					resourceKey={resourceKey ?? fileName}
					actions={{ ...imageActions, onDownload }}
					container={container}
					crop={crop}
					sourceSize={sourceSize}
					onClose={() => setModalOpen(false)}
					onRestoreFocus={() =>
						restoreTargetRef.current?.isConnected &&
						restoreTargetRef.current.focus({ preventScroll: true })
					}
				/>
			)}
			{agreementModal}
		</>
	)
}
