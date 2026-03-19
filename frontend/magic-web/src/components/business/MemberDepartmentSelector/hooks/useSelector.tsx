import { useEffect, useMemo, useRef, useState } from "react"
import {
	NodeType,
	TreeNode,
	User,
	type SelectedPath,
	Pagination,
	SegmentType,
	OrganizationNode,
	SegmentData,
	UserSelectorRef,
} from "@dtyq/user-selector"
import { useCurrentMagicOrganization } from "@/models/user/hooks"
import { useDebounce, useMemoizedFn, useMount } from "ahooks"
import { ContactApi } from "@/apis"
import useSWRMutation from "swr/mutation"
import type { StructureUserItem } from "@/types/organization"
import type { PaginationResponse } from "@/types/request"
import { uniqBy } from "lodash-es"
import useContacts, { defaultOperation } from "./useContacts"
import useOrganizationTree from "./useOrganizationTree"
import { MemberDepartmentSelectorProps } from ".."

/**
 * useMemberSelector
 * 用于提取 MemberDepartmentSelector 和 MobileMemberDepartmentSelector 组件的公共逻辑。

 */
export const useMemberDepartmentSelector = ({
	useAuthPanel,
	onlyDepartment,
	isConvertToUser,
	segmentOptions,
	onOk,
	onCancel,
	filterAgent,
	open,
}: MemberDepartmentSelectorProps) => {
	const ref = useRef<UserSelectorRef>(null)

	// 搜索框输入值
	const [searchValue, setSearchValue] = useState("")
	// 存储当前选中的路径
	const [selectedPath, setSelectPath] = useState<SelectedPath[]>([])
	// 添加搜索状态管理
	const [isSearching, setIsSearching] = useState(false)
	// 存储当前搜索结果
	const [searchResults, setSearchResults] = useState<Pagination<User>>({
		items: [],
		hasMore: false,
		page_token: "",
		loadMore: () => { },
	})

	// 最近联系人
	const { users: recentUsers } = useContacts()

	const organization = useCurrentMagicOrganization()

	const {
		data = { departments: [], users: [] },
		isLoading,
		mutate,
	} = useOrganizationTree(
		selectedPath?.length > 0 ? selectedPath[selectedPath.length - 1].id : "-1",
		!onlyDepartment,
	)

	useMount(() => {
		mutate()
	})

	useEffect(() => {
		if (!open) {
			setSelectPath([])
			initSearchResults()
			setIsSearching(false)
			setSearchValue("")
			setTimeout(() => {
				ref.current?.clearSearchValue()
			}, 500)
		}
	}, [open])

	// 组织信息
	const organizationInfo = useMemo(
		() => ({
			id: organization?.magic_organization_code ?? "",
			name: organization?.organization_name ?? "",
			logo: organization?.organization_logo ?? "",
		}),
		[organization],
	)

	// 组织架构数据源
	const dataArray = useMemo(
		() =>
			[
				...data.departments.map((item) => ({
					...item,
					dataType: NodeType.Department,
					operation: useAuthPanel ? defaultOperation : undefined,
				})),
				...data.users.map((item) => ({
					...item,
					dataType: NodeType.User,
					name: item.nickname,
					operation: useAuthPanel ? defaultOperation : undefined,
					path_nodes: item.path_nodes.filter((node) => node.department_id !== "-1"),
				})),
			] as OrganizationNode[],
		[data.departments, data.users, useAuthPanel],
	)

	// 分段面板数据
	const segmentData = useMemo(() => {
		// 如果分段数据为空，默认为组织数据
		if (!segmentOptions) return
		return segmentOptions.reduce((acc: SegmentData, segment) => {
			switch (segment) {
				case SegmentType.Recent:
					acc[segment] = recentUsers
					break
				case SegmentType.Organization:
					acc[segment] = dataArray
					break
				case SegmentType.Group:
				case SegmentType.Partner:
				default:
					break
			}
			return acc
		}, {} as SegmentData)
	}, [dataArray, recentUsers, segmentOptions])

	// 优化：增加防抖时间至800ms，减少搜索请求频率
	const debounceSearchValue = useDebounce(searchValue, {
		wait: 800,
	})

	// 使用 useSWRMutation 但不直接使用其返回的 data
	const { trigger: searchUser } = useSWRMutation<
		PaginationResponse<StructureUserItem>,
		any,
		string | false,
		{ page_token?: string; query: string; query_type: 1 | 2 }
	>(debounceSearchValue ? `searchUser/${debounceSearchValue}` : false, (_, { arg }) => {
		return ContactApi.searchUser({
			...arg,
			filter_agent: Boolean(filterAgent),
		})
	})

	// 赋值搜索结果
	const initSearchResults = useMemoizedFn((result?: PaginationResponse<User>) => {
		setSearchResults((prev) => ({
			...prev,
			items: result?.items ?? [],
			hasMore: result?.has_more ?? false,
			page_token: result?.page_token ?? "",
		}))
	})

	// 定义用户转换函数
	const transformUser = useMemoizedFn(
		(item: StructureUserItem): User => ({
			...item,
			id: item.user_id,
			name: item.nickname,
			dataType: NodeType.User,
			operation: useAuthPanel ? defaultOperation : undefined,
			path_nodes: item.path_nodes.filter((node) => node.department_id !== "-1"),
		}),
	)

	// 触发搜索
	const loadMore = useMemoizedFn(() => {
		if (!debounceSearchValue)
			return Promise.resolve({ items: [], has_more: false, page_token: "" })

		// 如果请求更多页，不重置当前结果
		if (searchResults.hasMore) {
			return searchUser({
				query: debounceSearchValue,
				query_type: 2,
				page_token: searchResults.page_token,
			}).then((result) => {
				// 更新搜索结果
				const newItems = result.items.map(transformUser)
				initSearchResults({
					...result,
					items: [...searchResults.items, ...newItems],
				})
				return result
			})
		}

		// 首页请求逻辑
		setIsSearching(true)
		return searchUser({
			query: debounceSearchValue,
			query_type: 2,
			page_token: "",
		})
			.then((result) => {
				const newItems = result.items.map(transformUser)
				initSearchResults({
					...result,
					items: newItems,
				})
				setIsSearching(false)
				return result
			})
			.catch((err) => {
				setIsSearching(false)
				throw err
			})
	})

	// 搜索值变化时重置搜索结果并触发新搜索
	useEffect(() => {
		if (debounceSearchValue) {
			// 设置搜索状态为正在搜索
			setIsSearching(true)
			// 清空当前结果，避免显示上次的搜索结果
			initSearchResults()

			searchUser({
				query: debounceSearchValue,
				query_type: 2,
				page_token: "",
			})
				.then((result) => {
					const newItems = result.items.map(transformUser)
					initSearchResults({
						...result,
						items: newItems,
					})
					setIsSearching(false)
				})
				.catch(() => {
					setIsSearching(false)
				})
		} else {
			// 无搜索词时清空结果
			initSearchResults()
			setIsSearching(false)
		}
	}, [debounceSearchValue])

	useEffect(() => {
		if (loadMore) {
			setSearchResults((prev) => ({
				...prev,
				loadMore: loadMore,
			}))
		}
	}, [loadMore])

	// 点击节点
	const onItemClick = (node: TreeNode) => {
		setSelectPath((prev) => [...prev, node])
	}

	// 点击面包屑
	const onBreadcrumbClick = (path: SelectedPath[]) => {
		console.log(path)
		setSelectPath(path)
	}

	// 提取部门下的所有人员
	const fetchDepartmentData = useMemoizedFn(async (departmentId: string) => {
		const InnerUser: User[] = []

		const [organization, members] = await Promise.all([
			ContactApi.getOrganization({
				department_id: departmentId,
				sum_type: 2,
			}),
			ContactApi.getOrganizationMembers({
				department_id: departmentId,
			}),
		])

		const childResults = await Promise.all(
			organization.items
				.filter((item) => item.employee_sum > 0)
				.map((item) => fetchDepartmentData(item.department_id)),
		)

		// 合并子部门的数据
		InnerUser.push(...childResults.flat())

		// 处理用户数据
		const newItems = members.items.map(transformUser)
		InnerUser.push(...newItems)
		return InnerUser
	})

	// 取消
	const onInnerCancel = () => {
		onCancel?.()
		setSelectPath([])
	}

	// 确定
	const onInnerOk = async (selected: TreeNode[]) => {
		try {
			// 是否将部门转换成人员
			if (isConvertToUser) {
				const { departmentList, userList, otherList } = selected.reduce(
					(acc, item) => {
						if (item.dataType === NodeType.Department) {
							acc.departmentList.push(item)
						} else if (item.dataType === NodeType.User) {
							acc.userList.push(item)
						} else {
							acc.otherList.push(item)
						}
						return acc
					},
					{
						departmentList: [] as TreeNode[],
						userList: [] as TreeNode[],
						otherList: [] as TreeNode[],
					},
				)
				// 获取部门下的所有人员
				const memberInDepartmentList = await Promise.all(
					departmentList.map((dept) => fetchDepartmentData(dept.id)),
				)

				// 合并部门成员和已选用户,去重后与其他类型数据合并
				const uniqueUsers = uniqBy([...memberInDepartmentList.flat(), ...userList], "id")
				const result = [...uniqueUsers, ...otherList]
				onOk?.(result)
			} else {
				onOk?.(selected)
			}
			onInnerCancel()
		} catch (error) {
			console.error(error)
		}
	}

	// 搜索框输入值变化
	const onSearchChange = (value: string) => {
		setSearchValue(value)
	}

	return {
		// 状态
		open,
		searchValue,
		selectedPath,
		dataArray,
		isLoading,
		isSearching,
		searchResults,
		organizationInfo,

		// 计算属性
		segmentData,

		// 方法
		onItemClick,
		onBreadcrumbClick,
		onSearchChange,
		onInnerOk,
		onInnerCancel,
		ref,
	}
}
