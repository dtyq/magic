import type { NodeProps } from "./types"
import { type ComponentType, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { withUserNode } from "../Card/UserCard"
import { withAssistantCard } from "../Card/AssistantCard"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import dayjs from "@/opensource/lib/dayjs"
import { cn } from "@/opensource/lib/utils"

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

		const { t } = useTranslation("super")

		const globalConfig = globalConfigStore.globalConfig

		// Select component by role without creating new components inside useMemo
		const ElementNode = role === "assistant" ? AssistantNode : UserNodeComponent

		// Format send time as "MM/DD HH:mm"
		const formattedTime = useMemo(() => {
			const sendTime = props?.node?.send_time
			if (!sendTime) return t("ui.agentLabel")
			return dayjs(sendTime * 1000).format("MM/DD HH:mm")
		}, [props?.node?.send_time, t])

		if (isFirst) {
			return (
				<div className="w-full last:mb-0">
					<div className={cn("flex h-6 w-full gap-1.5", "mb-[14px]", classNames?.header)}>
						<img
							src={getAvatarUrl(globalConfig?.minimal_logo || "", 24)}
							alt=""
							className={cn(
								"flex size-6 items-center justify-center rounded-full",
								classNames?.icon,
							)}
						/>
						<span className="text-[12px] leading-6 text-muted-foreground">
							{formattedTime}
						</span>
					</div>
					<ElementNode {...props} classNames={classNames} />
				</div>
			)
		}
		return <ElementNode {...props} classNames={classNames} />
	})
}
