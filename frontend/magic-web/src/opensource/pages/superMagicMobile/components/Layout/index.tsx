import { type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"

export interface SuperMagicMobileLayoutRef {
	closeNavigatePopup: () => void
}

interface SuperMagicMobileLayoutProps extends PropsWithChildren {
	header?: React.ReactNode
}

function SuperMagicMobileLayout(props: PropsWithChildren<SuperMagicMobileLayoutProps>) {
	const { header, children } = props

	return (
		<>
			<div className="flex h-full w-full flex-col overflow-hidden">
				{header}
				<div className="h-[calc(100%-50px-var(--safe-area-inset-top))] flex-1">
					{children}
				</div>
			</div>
		</>
	)
}

export default observer(SuperMagicMobileLayout)
