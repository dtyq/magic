import { memo, useEffect, useState } from "react"
import {
	UserSelector,
	AppearanceProvider,
	NodeType,
	type LocaleType,
	type Pagination,
	type SelectedPath,
	type TreeNode,
	type User,
	type UserSelectorProps,
} from "@dtyq/user-selector"
import "@dtyq/user-selector/style.css"
import { useDebounce, useMemoizedFn } from "ahooks"
import { uniqBy } from "lodash-es"
import { useAdminComponents } from "../AdminComponentsProvider"
import type { WithPageToken } from "./types"

export type MemberDepartmentSelectorProps = Omit<
	UserSelectorProps,
	| "data"
	| "searchData"
	| "checkbox"
	| "segmentData"
	| "onItemClick"
	| "onBreadcrumbClick"
	| "onSearchChange"
	| "loading"
> & {
	/** 初始数据 */
	initialData?: TreeNode[]
	/** 是否显示用户 */
	showUser?: boolean
	/** 是否将部门转换成人员 */
	isConvertToUser?: boolean
	/** 确定回调 */
	onOk?: (selected: TreeNode[]) => void
	/** 获取部门用户数据 */
	onFetchData?: (params: any) => Promise<TreeNode[]>
	/** 搜索用户 */
	searchUser?: (params: {
		query: string
		page_token?: string
		query_type?: number
	}) => Promise<WithPageToken<User>>
}

/**
 * 成员部门选择器【使用组件包 @dtyq/user-selector】
 * @param isConvertToUser 是否将部门转换成人员
 * @param onOk 确定回调
 * @param onCancel 取消回调
 * @param onFetchData 获取部门用户数据
 * @param searchUser 搜索用户操作
 * @param props 其他属性，参考 @dtyq/user-selector 内 UserSelectorProps
 */

const MemberDepartmentSelector = ({
	initialData,
	showUser = true,
	isConvertToUser = false,
	onOk,
	onCancel,
	onFetchData,
	searchUser,
	afterClose,
	...props
}: MemberDepartmentSelectorProps) => {
	const { language, theme } = useAdminComponents()
	// 搜索框输入值
	const [searchValue, setSearchValue] = useState("")

	// 存储当前选中的路径
	const [selectedPath, setSelectPath] = useState<SelectedPath[]>([])

	// 组织架构的数据
	const [data, setData] = useState<TreeNode[]>(initialData ?? [])

	// 加载中
	const [loading, setLoading] = useState(false)

	// 添加搜索状态管理
	const [isSearching, setIsSearching] = useState(false)

	// 存储当前搜索结果
	const [searchResults, setSearchResults] = useState<Pagination<TreeNode>>({
		items: [],
		hasMore: false,
		page_token: "",
		loadMore: () => void 0,
	})

	// 获取组织架构数据
	const innerFetchData = useMemoizedFn(async () => {
		setLoading(true)
		const res = await onFetchData?.({
			department_id:
				selectedPath?.length > 0 ? selectedPath[selectedPath.length - 1].id : "-1",
			with_member: showUser,
		})
		setData(res ?? [])
		setLoading(false)
	})

	useEffect(() => {
		// 如果存在初始数据，则数据变更，路径为空的情况下，赋值为初始数据
		if (initialData && initialData.length > 0 && selectedPath.length === 0) {
			setData(initialData)
			return
		}
		innerFetchData()
	}, [innerFetchData, selectedPath, showUser, initialData])

	// 优化：增加防抖时间至800ms，减少搜索请求频率
	const debounceSearchValue = useDebounce(searchValue, {
		wait: 800,
	})

	// 赋值搜索结果
	const initSearchResults = useMemoizedFn((result?: WithPageToken<User>) => {
		// 更新搜索结果
		const items = result ? [...searchResults.items, ...result.items] : []
		setSearchResults((prev) => ({
			...prev,
			items,
			hasMore: result?.has_more ?? false,
			page_token: result?.page_token ?? "",
		}))
	})

	// 触发搜索
	const loadMore = useMemoizedFn(async () => {
		if (!debounceSearchValue)
			return Promise.resolve({ items: [], has_more: false, page_token: "" })
		// 如果请求更多页，不重置当前结果
		if (searchResults.hasMore) {
			const result = await searchUser?.({
				query: debounceSearchValue,
				query_type: 1,
				page_token: searchResults.page_token,
			})

			initSearchResults(result)

			return result
		}
		return Promise.resolve({ items: [], has_more: false, page_token: "" })
	})

	useEffect(() => {
		setSearchResults((prev) => ({
			...prev,
			loadMore,
		}))
	}, [loadMore])

	// 搜索值变化时重置搜索结果并触发新搜索
	useEffect(() => {
		if (debounceSearchValue) {
			// 设置搜索状态为正在搜索
			setIsSearching(true)
			// 清空当前结果，避免显示上次的搜索结果
			initSearchResults()
			searchUser?.({
				query: debounceSearchValue,
				query_type: 1,
				page_token: "",
			})
				.then((result) => {
					initSearchResults(result)
				})
				.finally(() => {
					setIsSearching(false)
				})
		} else {
			// 无搜索词时清空结果
			initSearchResults()
			setIsSearching(false)
		}
	}, [debounceSearchValue, initSearchResults, searchUser])

	// 点击节点
	const onItemClick = (node: TreeNode) => {
		const isSelected = selectedPath.findIndex((item) => item.id === node.id)
		if (isSelected !== -1) return
		setSelectPath((prev) => [...prev, node])
	}

	// 点击面包屑
	const onBreadcrumbClick = (path: SelectedPath[]) => {
		setSelectPath(path)
	}

	// 提取部门下的所有人员
	const fetchDepartmentData = useMemoizedFn(async (departmentId: string) => {
		const InnerUser: User[] = []
		const res = await onFetchData?.({
			department_id: departmentId,
		})

		const departments = res?.filter((item) => item.dataType === NodeType.Department) ?? []
		const users = res?.filter((item) => item.dataType === NodeType.User) ?? []

		const childResults = await Promise.all(
			departments?.map((item) => fetchDepartmentData(item.id)),
		)
		// 合并子部门的数据
		InnerUser.push(...childResults.flat())
		// 处理用户数据
		InnerUser.push(...users)
		return InnerUser
	})

	// 获取所有用户
	const getAllSelectedUser = useMemoizedFn(async (selected: TreeNode[]) => {
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
		return [...uniqueUsers, ...otherList]
	})

	// 确定
	const onInnerOk = async (selected: TreeNode[]) => {
		// 是否将部门转换成人员
		if (isConvertToUser) {
			const allUsers = await getAllSelectedUser(selected)
			await onOk?.(allUsers)
		} else {
			await onOk?.(selected)
		}
	}

	// 关闭
	const onInnerAfterClose = () => {
		setSearchValue("")
		setSelectPath([])
		setData([])
		afterClose?.()
	}

	// 搜索框输入值变化
	const onSearchChange = (value: string) => {
		setSearchValue(value)
	}
	return (
		<AppearanceProvider theme={theme} language={language as LocaleType}>
			<UserSelector
				loading={loading || isSearching}
				data={data}
				searchData={searchResults}
				checkbox
				onOk={onInnerOk}
				onCancel={onCancel}
				selectedPath={selectedPath}
				onItemClick={onItemClick}
				onBreadcrumbClick={onBreadcrumbClick}
				onSearchChange={onSearchChange}
				afterClose={onInnerAfterClose}
				disableUser={!showUser}
				{...props}
			/>
		</AppearanceProvider>
	)
}
export default memo(MemberDepartmentSelector)
