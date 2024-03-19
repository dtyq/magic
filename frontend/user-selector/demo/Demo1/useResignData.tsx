import { Pagination, Resigned, TreeNode, User, UserGroup } from "@dtyq/user-selector"
import { useMemo, useState } from "react"
import { mockResigned, mockResigned2, mockUserGroups, mockUsers, mockUsers2 } from "../const"
import { useMemoizedFn } from "ahooks"

const defaultResignedData = {
	items: mockResigned,
	hasMore: true,
	loadMore: () => {},
}

export const useResignData = () => {
	const [resignedData, setResignedData] = useState<Pagination<Resigned>>(
		() => defaultResignedData,
	)
	const loadMore = useMemoizedFn(() => {
		setTimeout(() => {
			const newData = [...resignedData.items, ...mockResigned2]
			setResignedData((prev) => ({
				...prev,
				items: newData,
				hasMore: false,
			}))
		}, 1000)
	})

	const memoizedResigned = useMemo(
		() => ({
			...resignedData,
			loadMore,
			fetchData: () => {},
		}),
		[resignedData, loadMore],
	)

	return { memoizedResigned }
}

const defaultUserGroupData = {
	items: mockUserGroups,
	hasMore: true,
	loadMore: () => {},
}
export const useUserGroupData = () => {
	const [userGroupData, setUserGroupData] = useState<Pagination<UserGroup | User>>(
		() => defaultUserGroupData,
	)
	const loadMore = useMemoizedFn(() => {
		setTimeout(() => {
			const newData = [...userGroupData.items, ...mockUserGroups]
			setUserGroupData((prev) => ({
				...prev,
				items: newData,
				hasMore: false,
			}))
		}, 1000)
	})
	const memoizedUserGroup = useMemo(
		() => ({
			...userGroupData,
			loadMore,
			fetchData: () => {},
		}),
		[userGroupData, loadMore],
	)

	const updateUserGroupData = useMemoizedFn((item: TreeNode) => {
		if (item.id === "user_group_0") {
			setUserGroupData((prev) => ({
				...prev,
				items: mockUsers,
				hasMore: false,
			}))
		} else {
			setUserGroupData((prev) => ({
				...prev,
				items: mockUsers2,
				hasMore: true,
			}))
		}
	})

	return { memoizedUserGroup, updateUserGroupData }
}
