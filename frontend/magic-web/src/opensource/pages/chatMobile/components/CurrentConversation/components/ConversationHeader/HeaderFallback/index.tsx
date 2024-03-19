import FlexBox from "@/opensource/components/base/FlexBox"

interface HeaderFallbackProps {
	headerTitleClass?: string
	headerSubTitleClass?: string
	className?: string
}

function HeaderFallback({ headerTitleClass, headerSubTitleClass, className }: HeaderFallbackProps) {
	return (
		<FlexBox vertical className={className}>
			<div className={headerTitleClass} style={{ opacity: 0.5 }}>
				Loading...
			</div>
			<div className={headerSubTitleClass} style={{ opacity: 0.3 }}>
				--
			</div>
		</FlexBox>
	)
}

export default HeaderFallback
