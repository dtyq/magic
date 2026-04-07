import TypingHint from "@/pages/superMagic/components/ConversationPanelScaffold/TypingHint"
import { memo } from "react"
import EmptyHintArrow from "./EmptyHintArrow"

interface AnimatedEmptyHintProps {
	className?: string
	primaryText: string
	secondaryText: string
	isActive?: boolean
}

function AnimatedEmptyHint({
	className,
	primaryText,
	secondaryText,
	isActive = true,
}: AnimatedEmptyHintProps) {
	return (
		<TypingHint
			className={className}
			primaryText={primaryText}
			secondaryText={secondaryText}
			isActive={isActive}
			decoration={<EmptyHintArrow />}
			decorationClassName="absolute -top-[20px] left-[calc(50%+56px)] ml-[70px] -translate-x-1/2 rotate-[-50deg] text-sidebar-foreground"
			testId="crew-topic-empty-hint-animation"
			primaryLineTestId="crew-topic-empty-hint-line-1"
			secondaryLineTestId="crew-topic-empty-hint-line-2"
			decorationTestId="crew-topic-empty-hint-arrow"
		/>
	)
}

export default memo(AnimatedEmptyHint)
