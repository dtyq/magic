import { lazy, type ChangeEvent, useState } from "react"
import { useDebounce, useMemoizedFn } from "ahooks"
import type { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useAiAssistantData } from "./hooks/useAiAssistantData"
import { observer } from "mobx-react-lite"
import MagicInfiniteList from "@/components/business/MagicInfiniteList"
import { MagicAvatar } from "@/components/base"
import { useOpenAiAssistantChat } from "./hooks/useOpenAiAssistantChat"
import { AiAssistantSearch } from "@/pages/contacts/components/AiAssistantSearch"

const itemWrapperClassName =
	"[--magic-list-item-padding:0px] mt-2.5 box-border w-full rounded-md bg-background transition-colors [border-block-end:none!important]"

const itemButtonClassName =
	"hover:bg-fill p-2 active:bg-fill-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring inline-flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent p-0 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"

const itemContentClassName = "min-w-0 flex-1"

const itemNameClassName = "truncate text-sm font-medium leading-5 text-foreground"

const itemDescriptionClassName = "truncate text-xs leading-[18px] text-muted-foreground"

const Item = observer(({ item }: { item: UserAvailableAgentInfo }) => {
	const openAiAssistantChat = useOpenAiAssistantChat()

	const handleItemClick = () => {
		void openAiAssistantChat(item)
	}

	return (
		<button type="button" onClick={handleItemClick} className={itemButtonClassName}>
			<MagicAvatar src={item.agent_avatar || item.robot_avatar} size={40}>
				{item.agent_name || item.robot_name}
			</MagicAvatar>
			<div className={itemContentClassName}>
				<div className={itemNameClassName}>{item.agent_name || item.robot_name}</div>
				<div className={itemDescriptionClassName}>
					{item.agent_description || item.robot_description}
				</div>
			</div>
		</button>
	)
})

const AiAssistant = observer(function AiAssistant() {
	const [searchValue, setSearchValue] = useState("")

	const debouncedSearchValue = useDebounce(searchValue, { wait: 500 })

	const { fetchAiAssistantData, initialData } = useAiAssistantData({
		keyword: debouncedSearchValue || "",
	})

	const handleSearchValueChange = useMemoizedFn((event: ChangeEvent<HTMLInputElement>) => {
		setSearchValue(event.target.value)
	})

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
			<div className="px-2.5 pb-0 pt-2.5">
				<AiAssistantSearch value={searchValue} onChange={handleSearchValueChange} />
			</div>
			<div className="box-border min-h-0 flex-1 px-2.5 pb-2.5">
				<MagicInfiniteList<UserAvailableAgentInfo>
					key={debouncedSearchValue || "all"}
					dataFetcher={fetchAiAssistantData}
					initialData={initialData}
					renderItem={(item: UserAvailableAgentInfo) => <Item item={item} />}
					getItemKey={(item: UserAvailableAgentInfo) => item.id}
					useDefaultItemStyles={false}
					itemClassName={itemWrapperClassName}
				/>
			</div>
		</div>
	)
})

const AiAssistantMobile = lazy(() => import("@/pages/contactsMobile/aiAssistant"))

export default () => {
	const isMobile = useIsMobile()
	return isMobile ? <AiAssistantMobile /> : <AiAssistant />
}
