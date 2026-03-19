import { ComponentType } from "react"
import MagicSafeArea from "@/components/base/MagicSafeArea"

export default function withMobilePage<P extends object>(PageComponent: ComponentType<P>) {
	return function WrappedPageComponent(props: P) {
		return (
			<>
				<MagicSafeArea position="top" />
				<PageComponent {...props} />
				<MagicSafeArea position="bottom" />
			</>
		)
	}
}
