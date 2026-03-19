import { memo } from "react"
import { CommonHeaderV2Props } from "../../../../components/CommonHeaderV2/types"
import CommonHeaderV2 from "../../../../components/CommonHeaderV2"

export default memo(function CanvasDesignHeaderV2(props: CommonHeaderV2Props) {
	return (
		<div
			className="absolute right-[10px] top-[10px] z-50 flex items-center justify-center gap-[var(--spacing-1,4px)] rounded-full border bg-[var(--base-background,#FFF)] p-[var(--spacing-1,4px)]"
			style={{
				borderColor: "var(--base-border, #E5E5E5)",
				boxShadow:
					"var(--shadow-xs-offset-x, 0) var(--shadow-xs-offset-y, 1px) var(--shadow-xs-blur-radius, 2px) var(--shadow-xs-spread-radius, 0) var(--shadow-xs-color, rgba(0, 0, 0, 0.05))",
			}}
		>
			<CommonHeaderV2 {...props} renderMode="actions" />
		</div>
	)
})
