import { Spin, Empty } from "antd"
import { useTranslation } from "react-i18next"
import type { Editor } from "@tiptap/react"
import { useProjectImages } from "../hooks/use-project-images"
import { useLazyImage } from "../hooks/use-lazy-image"
import { useStyles } from "../styles"
import type { ImageAttachment } from "../types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface ProjectTabProps {
	editor: Editor | null
	projectId?: string
	onSuccess?: () => void
}

interface ImageItemProps {
	image: ImageAttachment
	onClick: () => void
}

function ImageItem({ image, onClick }: ImageItemProps) {
	const { styles } = useStyles()
	const { ref, url, loading } = useLazyImage(image.file_id)

	return (
		<div ref={ref} className={styles.imageItem} onClick={onClick}>
			<div className={styles.imageWrapper}>
				{loading && <Spin />}
				{!loading && url && <img src={url} alt={image.file_name} />}
				{!loading && !url && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="" />}
			</div>
			<div className={styles.imageName} title={image.file_name}>
				{image.file_name}
			</div>
		</div>
	)
}

export function ProjectTab({ editor, projectId, onSuccess }: ProjectTabProps) {
	const { t } = useTranslation("tiptap")
	const { styles, cx } = useStyles()
	const { images, loading, error } = useProjectImages(projectId)

	const handleImageClick = async (image: ImageAttachment) => {
		if (!editor) return

		try {
			if (image.relative_file_path) {
				// Insert the image directly using the URL
				editor.commands.insertProjectImageFromPath(image.relative_file_path)
				onSuccess?.()
			} else {
				magicToast.error(t("projectImage.errors.pathNotFound"))
			}
		} catch (err) {
			console.error("Failed to insert project image:", err)
		}
	}

	if (loading) {
		return (
			<div className={styles.tabContent}>
				<div style={{ textAlign: "center", padding: "60px 0" }}>
					<Spin tip={t("projectImage.dropdown.project.loading")} />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className={styles.tabContent}>
				<div className={styles.errorState}>
					<Empty description={error.message} />
				</div>
			</div>
		)
	}

	if (images.length === 0) {
		return (
			<div className={styles.tabContent}>
				<div className={styles.emptyState}>
					<Empty description={t("projectImage.dropdown.project.empty")} />
				</div>
				<div className={styles.hint}>{t("projectImage.dropdown.project.hint")}</div>
			</div>
		)
	}

	return (
		<div className={styles.projectTabContent}>
			<div className={cx(styles.hint, styles.projectHint)}>
				{t("projectImage.dropdown.project.hint")}
			</div>
			<div className={styles.imageGrid}>
				{images.map((image) => (
					<ImageItem
						key={image.file_id}
						image={image}
						onClick={() => handleImageClick(image)}
					/>
				))}
			</div>
		</div>
	)
}
