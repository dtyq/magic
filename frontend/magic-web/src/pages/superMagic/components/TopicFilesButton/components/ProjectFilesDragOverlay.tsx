import { IconFileUpload } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import MagicIcon from "@/components/base/MagicIcon"
import FlexBox from "@/components/base/FlexBox"

const useStyles = createStyles(({ token, css }) => ({
	overlay: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 8px;
	`,
	content: css`
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: ${token.colorBgContainer};
		min-width: 240px;
		text-align: center;
		padding: 24px;
	`,
	icon: css`
		color: ${token.colorPrimary};
	`,
	text: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		margin-top: 8px;
	`,
	subText: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		margin-top: 4px;
	`,
}))

export interface ProjectFilesDragOverlayProps {
	visible: boolean
}

function ProjectFilesDragOverlay({ visible = false }: ProjectFilesDragOverlayProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	if (!visible) return null

	return (
		<div className={styles.overlay}>
			<FlexBox vertical align="center" justify="center" className={styles.content}>
				<MagicIcon size={40} component={IconFileUpload} className={styles.icon} />
				<div className={styles.text}>
					{t("topicFiles.dragUpload.title", "将文件或文件夹拖拽至此")}
				</div>
				<div className={styles.subText}>
					{t("topicFiles.dragUpload.subtitle", "松开鼠标即可选择存储位置")}
				</div>
			</FlexBox>
		</div>
	)
}

export default ProjectFilesDragOverlay
