import { memo } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import useNavigate from "@/routes/hooks/useNavigate"

interface BackButtonProps {
	onClick?: () => void
	label?: string
	className?: string
	"data-testid"?: string
}

function BackButton({ onClick, label, className, "data-testid": dataTestId }: BackButtonProps) {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()

	function handleClick() {
		if (onClick) {
			onClick()
		} else {
			navigate({ delta: -1 })
		}
	}

	return (
		<Button
			variant="secondary"
			size="sm"
			className={cn("shadow-xs h-8 gap-2", className)}
			onClick={handleClick}
			data-testid={dataTestId}
		>
			<ArrowLeft className="h-4 w-4" />
			<span className="text-xs">{label ?? t("back")}</span>
		</Button>
	)
}

export default memo(BackButton)
