import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Copy } from "lucide-react"
import { useCallback, type MouseEvent } from "react"
import { toast } from "sonner"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { TooltipContent } from "../shadcn/tooltip"
import { usePortalContainer } from "./PortalContainerContext"

interface ResourcePathTooltipContentProps {
	path: string
	displayName?: string
}

export default function ResourcePathTooltipContent({
	path,
	displayName,
}: ResourcePathTooltipContentProps) {
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const handleCopy = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			event.stopPropagation()
			const clipboard = navigator.clipboard
			if (!clipboard) return
			void clipboard
				.writeText(path)
				.then(() => toast.success(t("menu.copySuccess", "复制成功")))
				.catch(() => undefined)
		},
		[path, t],
	)

	return (
		<TooltipPrimitive.Portal container={portalContainer || undefined}>
			<TooltipContent
				side="top"
				sideOffset={6}
				className="w-max max-w-[85vw] overflow-hidden border-black bg-black text-white"
			>
				<div className="flex max-w-full items-center gap-1.5">
					<span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left">
						{displayName || path}
					</span>
					<button
						type="button"
						className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm p-0.5 text-inherit hover:bg-white/15"
						aria-label={t("messageHistory.copyResourcePath", "复制资源路径")}
						title={t("messageHistory.copyResourcePath", "复制资源路径")}
						onClick={handleCopy}
					>
						<Copy size={14} />
					</button>
				</div>
				<TooltipPrimitive.Arrow className="fill-black" />
			</TooltipContent>
		</TooltipPrimitive.Portal>
	)
}
