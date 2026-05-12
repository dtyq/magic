import { memo } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { CommonHeaderV2Props } from "../../../../components/CommonHeaderV2/types"
import CommonHeaderV2 from "../../../../components/CommonHeaderV2"
import {
	HistoryVersionBanner,
	HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX,
} from "../../../../components/CommonHeader/components/HistoryVersionBanner"

export default memo(function CanvasDesignHeaderV2(props: CommonHeaderV2Props) {
	const isMobile = useIsMobile()
	const showVersionBanner =
		!props.isNewestFileVersion &&
		!isMobile &&
		props.fileVersionsList &&
		props.fileVersionsList.length > 0

	// 有 banner 时悬浮按钮下移，避免遮挡 banner（与 HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX 一致）
	const actionsTopOffset = showVersionBanner
		? `${HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX + 8}px`
		: "10px"

	return (
		<>
			{showVersionBanner ? (
				<div className="absolute left-0 right-0 top-0 z-40">
					<HistoryVersionBanner
						data-testid="detail-header-history-version-banner"
						fileVersionsList={props.fileVersionsList}
						fileVersion={props.fileVersion}
						onReturnLatest={() => props.changeFileVersion?.(undefined)}
						onRollback={props.handleVersionRollback}
						allowEdit={props.allowEdit}
					/>
				</div>
			) : null}
			<div
				className="absolute right-[10px] z-50 flex items-center justify-center gap-[var(--spacing-1,4px)] rounded-full border bg-[var(--base-background,#FFF)] p-[var(--spacing-1,4px)]"
				style={{
					top: actionsTopOffset,
					borderColor: "var(--base-border, #E5E5E5)",
					boxShadow:
						"var(--shadow-xs-offset-x, 0) var(--shadow-xs-offset-y, 1px) var(--shadow-xs-blur-radius, 2px) var(--shadow-xs-spread-radius, 0) var(--shadow-xs-color, rgba(0, 0, 0, 0.05))",
				}}
			>
				<CommonHeaderV2 {...props} renderMode="actions" />
			</div>
		</>
	)
})
