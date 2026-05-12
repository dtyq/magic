import { useLayoutEffect, useRef } from "react"
import { LoaderCircle } from "lucide-react"
import { cn } from "../../lib/utils"
import { ReferenceSlotVideoIcon } from "../ui/icons"
import styles from "../MessageEditor/index.module.css"
import { useReferenceVideoPoster } from "./useReferenceVideoPoster"

export interface ReferenceVideoPosterThumbnailProps {
	fileName: string
	path: string
	fillParent?: boolean
	objectFit?: "cover" | "contain"
}

/** 视频参考槽位：与画布同源，用 VideoResourceManager 解码首帧海报 */
export function ReferenceVideoPosterThumbnail(props: ReferenceVideoPosterThumbnailProps) {
	const { fileName, path, fillParent, objectFit = "cover" } = props
	const { loadState, posterClone } = useReferenceVideoPoster(path)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useLayoutEffect(() => {
		const el = canvasRef.current
		if (!el || !posterClone || loadState !== "ready") return
		el.width = posterClone.width
		el.height = posterClone.height
		const ctx = el.getContext("2d")
		if (!ctx) return
		ctx.clearRect(0, 0, el.width, el.height)
		ctx.drawImage(posterClone, 0, 0)
	}, [posterClone, loadState])

	const thumbWrapperClass = cn(
		styles.referenceImageThumbnail,
		fillParent && styles.referenceImageThumbnailFill,
		fillParent && objectFit === "contain" && styles.referenceImageThumbnailFillContain,
	)

	if (loadState === "loading") {
		return (
			<div className={thumbWrapperClass}>
				<div className={styles.referenceImageLoading}>
					<LoaderCircle size={12} className={styles.loadingIcon} />
				</div>
			</div>
		)
	}

	if (loadState === "error" || !posterClone) {
		return (
			<div className={thumbWrapperClass}>
				<div className="flex h-full w-full items-center justify-center bg-muted/40">
					<ReferenceSlotVideoIcon size={28} />
				</div>
			</div>
		)
	}

	return (
		<div className={thumbWrapperClass}>
			<canvas
				ref={canvasRef}
				className={styles.referenceImageThumbnailImgCover}
				role="img"
				aria-label={fileName}
			/>
		</div>
	)
}
