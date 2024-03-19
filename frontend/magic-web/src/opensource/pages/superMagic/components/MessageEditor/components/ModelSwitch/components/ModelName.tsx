import EllipsisTooltip from "@/opensource/pages/vectorKnowledge/components/Create/components/EllipsisTooltip"
import { getBrowserInfo } from "@/opensource/providers/BrowserProvider/browser"
import { cn } from "@/opensource/lib/utils"
import { isMaxModel } from "../utils"
import { ModelItem } from "../types"

interface ModelNameProps {
	model?: ModelItem | null
	isSelected: boolean
	className?: string
}

const modelNameBase =
	"max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold leading-[1.33] text-foreground/80 [font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]"

const modelNameSafari =
	"font-semibold antialiased [text-rendering:optimizeLegibility] [transform:translateZ(0)] [backface-visibility:hidden]"

const modelNameMax =
	"animate-gradient-flow bg-[length:200%_100%] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-[linear-gradient(95deg,#261f46_0%,#331adb_49.38%,#a517fd_98.76%)]"

const browserInfo = getBrowserInfo()

function ModelName({ model, isSelected, className }: ModelNameProps) {
	if (!model) return null

	const isSafari = browserInfo.name === "Safari"

	return (
		<EllipsisTooltip title={model.model_name}>
			<div
				className={cn(
					modelNameBase,
					isSafari && modelNameSafari,
					className,
					isSelected && "text-primary",
					isMaxModel(model) && modelNameMax,
				)}
			>
				{model.model_name || model.model_id}
			</div>
		</EllipsisTooltip>
	)
}

export default ModelName
