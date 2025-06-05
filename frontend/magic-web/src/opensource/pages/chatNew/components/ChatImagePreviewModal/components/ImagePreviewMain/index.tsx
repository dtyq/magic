import MagicImagePreview from "@/opensource/components/base/MagicImagePreview"
import { resolveToString } from "@dtyq/es6-template-strings"
import { Flex, Progress } from "antd"
import useStyles from "../../styles"
import ImageCompareSlider from "../ImageCompareSlider"
import MessageImagePreview from "@/opensource/services/chat/message/MessageImagePreview"
import { ImagePreviewInfo } from "@/types/chat/preview"
import useCurrentImageSwitcher from "@/opensource/components/base/MagicImagePreview/hooks/useCurrentImageSwitcher"
import useImageAction from "../../hooks/useImageAction"
import { memo, useMemo, useRef } from "react"
import useImageSize from "@/opensource/components/base/MagicImagePreview/hooks/useImageSize"
import { useTranslation } from "react-i18next"
import { isEqual } from "lodash-es"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import { useMemoizedFn } from "ahooks"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconCopy } from "@tabler/icons-react"

interface ImagePreviewMainProps {
	info: ImagePreviewInfo | undefined
	loading: boolean
	progress: number
	containerClassName?: string
}

const ImagePreviewMain = memo(function ImagePreviewMain({
	info,
	containerClassName,
}: ImagePreviewMainProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const imageRef = useRef<HTMLImageElement>(null)
	const isLongImage = useImageSize(info?.url)

	const { toNext, toPrev, nextDisabled, prevDisabled } = useCurrentImageSwitcher()
	const {
		currentImage,
		loading,
		progress,
		isCompare,
		isPressing,
		viewType,
		setViewType,
		onLongPressStart,
		onLongPressEnd,
	} = useImageAction(info)

	const ImageNode = useMemo(() => {
		switch (info?.ext?.ext) {
			case "svg":
			case "svg+xml":
				return (
					currentImage && (
						<div
							draggable={false}
							dangerouslySetInnerHTML={{ __html: currentImage }}
							className={styles.svg}
						/>
					)
				)
			default:
				return (
					<img
						ref={imageRef}
						src={currentImage}
						alt=""
						draggable={false}
						style={
							isLongImage
								? {
										objectFit: "contain",
										width: "100%",
								  }
								: {
										objectFit: "contain",
										width: "100%",
										height: "100%",
								  }
						}
					/>
				)
		}
	}, [info?.ext?.ext, currentImage, styles.svg, isLongImage])

	const getContextMenuItems = useMemoizedFn(() => {
		return [
			{
				key: "download",
				label: (
					<Flex align="center" gap={4}>
						<MagicIcon component={IconCopy} size={16} color="currentColor" />
						{t("chat.imagePreview.copy")}
					</Flex>
				),
				onClick: () => {
					if (imageRef.current) {
						MessageImagePreview.copy(imageRef.current)
					}
				},
			},
		]
	})

	if (!currentImage)
		return (
			<Flex justify="center" align="center" className={styles.imagePreview}>
				<MagicEmpty description={t("chat.NoContent", { ns: "message" })} />
			</Flex>
		)

	return (
		<MagicDropdown
			trigger={["contextMenu"]}
			menu={{
				items: getContextMenuItems(),
			}}
		>
			<div className={containerClassName}>
				<MagicImagePreview
					rootClassName={styles.imagePreview}
					onNext={info?.standalone ? undefined : toNext}
					onPrev={info?.standalone ? undefined : toPrev}
					nextDisabled={nextDisabled}
					prevDisabled={prevDisabled}
					hasCompare={isCompare}
					viewType={viewType}
					onChangeViewType={setViewType}
					onLongPressStart={onLongPressStart}
					onLongPressEnd={onLongPressEnd}
				>
					{isCompare ? (
						<ImageCompareSlider
							info={info}
							viewType={viewType}
							isPressing={isPressing}
						/>
					) : (
						ImageNode
					)}
				</MagicImagePreview>
				{loading && (
					<Flex align="center" gap={10} className={styles.mask}>
						<Progress percent={progress} showInfo={false} className={styles.progress} />
						<Flex
							vertical
							gap={2}
							align="center"
							justify="center"
							className={styles.progressText}
						>
							<span>
								{resolveToString(t("chat.imagePreview.hightImageConverting"), {
									num: progress,
								})}
							</span>
							<span>{t("chat.imagePreview.convertingCloseTip")}</span>
						</Flex>
					</Flex>
				)}
			</div>
		</MagicDropdown>
	)
},
isEqual)

export default ImagePreviewMain
