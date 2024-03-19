import { IconFileUpload } from "@tabler/icons-react"
import { useStyles } from "./styles"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import FlexBox from "@/opensource/components/base/FlexBox"

export interface DragOverlayProps {
	visible: boolean
}

const DragOverlay: React.FC<DragOverlayProps> = ({ visible = false }: DragOverlayProps) => {
	const { styles } = useStyles()

	if (!visible) return null

	return (
		<div className={styles.overlay}>
			<FlexBox vertical align="center" justify="center" gap={10} className={styles.content}>
				<MagicIcon size={32} component={IconFileUpload} className={styles.icon} />
				<div className={styles.text}>将本地文件添加至对话中</div>
			</FlexBox>
		</div>
	)
}

export default DragOverlay
