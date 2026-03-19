import { memo } from "react"
import BackButton from "@/pages/superMagic/components/BackButton"

interface PageTopBarProps {
	backButtonTestId: string
	"data-testid"?: string
}

function PageTopBar({ backButtonTestId, "data-testid": dataTestId }: PageTopBarProps) {
	return (
		<div
			className="flex h-12 shrink-0 items-center justify-between overflow-hidden px-3 sm:px-4"
			data-testid={dataTestId ?? "page-top-bar"}
		>
			<BackButton data-testid={backButtonTestId} />
		</div>
	)
}

export default memo(PageTopBar)
