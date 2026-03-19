import { useMemo } from "react"
import conversationSidebarStore from "@/stores/chatNew/conversationSidebar"
import { ConversationGroupLists, MessageGroupKey } from "../types"

const INITIAL_BATCH_SIZE = window.innerHeight / 40

/**
 * Hook for managing conversation groups
 */
export function useConversationGroups() {
	const {
		conversationSiderbarGroups: {
			top: topGroup,
			single: singleGroup,
			group: groupGroup,
			ai: aiGroup,
		},
	} = conversationSidebarStore

	const topGroupKey = (topGroup ?? []).join("|")
	const singleGroupKey = (singleGroup ?? []).join("|")
	const groupGroupKey = (groupGroup ?? []).join("|")
	const aiGroupKey = (aiGroup ?? []).join("|")

	const topGroupList = useMemo(() => {
		const key = topGroupKey
		void key
		return topGroup ? [...topGroup] : []
	}, [topGroup, topGroupKey])

	const singleGroupList = useMemo(() => {
		const key = singleGroupKey
		void key
		return singleGroup ? [...singleGroup] : []
	}, [singleGroup, singleGroupKey])

	const groupGroupList = useMemo(() => {
		const key = groupGroupKey
		void key
		return groupGroup ? [...groupGroup] : []
	}, [groupGroup, groupGroupKey])

	const aiGroupList = useMemo(() => {
		const key = aiGroupKey
		void key
		return aiGroup ? [...aiGroup] : []
	}, [aiGroup, aiGroupKey])

	const firstAvailableGroup = useMemo(() => {
		if (topGroupList.length) return MessageGroupKey.Pinned
		if (singleGroupList.length) return MessageGroupKey.Single
		if (groupGroupList.length) return MessageGroupKey.Group
		return undefined
	}, [groupGroupList.length, singleGroupList.length, topGroupList.length])

	return {
		topGroupList,
		singleGroupList,
		groupGroupList,
		aiGroupList,
		topGroupKey,
		singleGroupKey,
		groupGroupKey,
		aiGroupKey,
		firstAvailableGroup,
	}
}
