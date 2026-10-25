import { Film } from "lucide-react"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useMagic } from "../../../../../app/providers/MagicProvider"
import {
	canCreateStoryboardVideosFromConnection,
	createStoryboardVideosFromConnection,
} from "../../../../../runtime/interaction/connection/imageVideoBatchCreation"
import { isStoryboardOutputFrame } from "../../../../../runtime/interaction/storyboard/storyboardOutputFrame"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "../../common/DownloadButton/index.module.css"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function StoryboardVideoBatchButton() {
	const { canvas } = useCanvas()
	const { videoModelList } = useMagic()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const tool = useElementToolResolution()

	const selectedFrame = selectedElements[0]
	const frameId = selectedFrame?.type === ElementTypeEnum.Frame ? selectedFrame.id : null
	const origin = frameId
		? ({ kind: "element", elementId: frameId, side: "right" } as const)
		: null
	const canCreate = Boolean(
		canvas &&
		canvas.permissionManager.can("sideEffect.generate") &&
		origin &&
		isStoryboardOutputFrame(canvas, frameId ?? "") &&
		canCreateStoryboardVideosFromConnection(canvas, origin, videoModelList),
	)
	const label = t("storyboardVideo.executeAll", "整组执行")

	const handleClick = () => {
		if (
			!canvas ||
			!canvas.permissionManager.can("sideEffect.generate") ||
			!origin ||
			!isStoryboardOutputFrame(canvas, frameId ?? "") ||
			!canCreateStoryboardVideosFromConnection(canvas, origin, videoModelList)
		) {
			return
		}

		if (tool) {
			void tool.execute({ origin, videoModelList })
			return
		}
		createStoryboardVideosFromConnection({ canvas, origin, videoModelList })
	}

	return (
		<IconButton
			onClick={handleClick}
			className={styles.downloadButton}
			title={label}
			disabled={!canCreate}
		>
			<Film size={16} />
			<span className={styles.buttonText}>{label}</span>
		</IconButton>
	)
}
