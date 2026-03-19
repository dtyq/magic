import { PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"

function SuperMagicMobileLayoutSkeleton({ children }: PropsWithChildren) {
	return <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
}

export default observer(SuperMagicMobileLayoutSkeleton)
