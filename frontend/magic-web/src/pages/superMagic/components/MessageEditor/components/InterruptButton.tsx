import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import InterruptSvg from "../../../assets/svg/interrupt.svg"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/shadcn-ui/spinner"

interface InterruptButtonProps {
	/**
	 * Whether the interrupt button should be visible
	 */
	visible: boolean
	/**
	 * Icon size for the button
	 */
	iconSize?: number
	/**
	 * Callback when interrupt button is clicked
	 */
	onInterrupt?: () => void
	/** loading */
	loading?: boolean
	/**
	 * Class names for the button
	 */
	classNames?: string
}

/**
 * InterruptButton - Interrupt button component for stopping running tasks
 */
function InterruptButton({
	visible,
	iconSize = 32,
	onInterrupt,
	loading,
	classNames,
}: InterruptButtonProps) {
	const { t } = useTranslation("super")

	// Only render when visible
	if (!visible) {
		return null
	}

	const buttonNode = (
		<button
			type="button"
			onClick={onInterrupt}
			aria-label={t("common.interrupt")}
			className={cn(
				"flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 transition-all hover:opacity-80 active:opacity-60",
				classNames,
			)}
			data-testid="interrupt-button"
		>
			{loading ? (
				<div
					className="flex items-center justify-center rounded-lg bg-sidebar-accent"
					style={{ width: iconSize, height: iconSize }}
				>
					<Spinner className="animate-spin" size={iconSize * 0.6} />
				</div>
			) : (
				<img
					src={InterruptSvg as string}
					alt=""
					style={{ width: iconSize, height: iconSize }}
				/>
			)}
		</button>
	)

	return <Tooltip title={t("common.interrupt")}>{buttonNode}</Tooltip>
}

export default InterruptButton
