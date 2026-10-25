import { AssistantMessageHeader } from "./AssistantMessageHeader"
import type { NodeProps } from "./types"
import { type ComponentType } from "react"
import { observer } from "mobx-react-lite"
import { withUserNode } from "../Card/UserCard"
import { withAssistantCard } from "../Card/AssistantCard"

export interface WithNodeProps extends NodeProps {
	role: string
	isFirst: boolean
	classNames?: {
		card?: string
		header?: string
		icon?: string
		markdown?: string
	}
}

export const withNode = (WrapperComponent: ComponentType<WithNodeProps>) => {
	// Create HOC-wrapped components outside to instantiate only once
	const AssistantNode = withAssistantCard(WrapperComponent)
	const UserNodeComponent = withUserNode(WrapperComponent)

	return observer((props: WithNodeProps) => {
		const { role, isFirst, classNames } = props

		// Select component by role without creating new components inside useMemo
		const ElementNode =
			role === "assistant" || role === "tool" ? AssistantNode : UserNodeComponent

		if (isFirst) {
			return (
				<AssistantMessageHeader sendTime={props.node?.send_time} classNames={classNames}>
					<ElementNode {...props} classNames={classNames} />
				</AssistantMessageHeader>
			)
		}
		return <ElementNode {...props} classNames={classNames} />
	})
}
