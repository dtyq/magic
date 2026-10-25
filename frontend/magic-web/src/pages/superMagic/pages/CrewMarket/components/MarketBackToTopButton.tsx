import { useEffect, useState, type RefObject } from "react"
import { ArrowUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

const BACK_TO_TOP_SCROLL_THRESHOLD = 320

interface MarketBackToTopButtonProps {
	viewportRef: RefObject<HTMLDivElement | null>
	testId: string
}

function MarketBackToTopButton({ viewportRef, testId }: MarketBackToTopButtonProps) {
	const { t } = useTranslation("crew/market")
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const viewport = viewportRef.current
		if (!viewport) return

		const updateVisibility = () => {
			setIsVisible(viewport.scrollTop > BACK_TO_TOP_SCROLL_THRESHOLD)
		}

		updateVisibility()
		viewport.addEventListener("scroll", updateVisibility, { passive: true })
		return () => viewport.removeEventListener("scroll", updateVisibility)
	}, [viewportRef])

	function handleBackToTop() {
		viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
	}

	const label = t("backToTop")

	return (
		<Button
			type="button"
			size="icon"
			className={cn(
				"absolute bottom-6 right-6 z-[60] size-11 rounded-full shadow-lg",
				"transition-[opacity,transform] duration-150 ease-out active:scale-[0.96]",
				isVisible
					? "translate-y-0 opacity-100"
					: "pointer-events-none translate-y-2 opacity-0",
			)}
			aria-label={label}
			aria-hidden={!isVisible}
			tabIndex={isVisible ? 0 : -1}
			title={label}
			data-testid={testId}
			onClick={handleBackToTop}
		>
			<ArrowUp className="size-5" aria-hidden />
		</Button>
	)
}

export default MarketBackToTopButton
