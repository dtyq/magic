import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { useSearchExpandedKeys } from "./useSearchExpandedKeys"

interface UseTreeUIOptions {
	organizationCode?: string
	projectId?: string
	enableCache?: boolean
	expandedKeys?: React.Key[]
	onExpandedKeysChange?: (keys: React.Key[]) => void
	// 搜索相关
	searchValue?: string
	matchedItemPaths?: string[]
}

/**
 * useTreeUI - 管理树形组件的UI状态
 */
export function useTreeUI(options?: UseTreeUIOptions) {
	const {
		organizationCode: orgCode,
		projectId,
		enableCache = true,
		searchValue = "",
		matchedItemPaths = [],
	} = options || {}
	const { organizationCode: userOrgCode } = useOrganization()
	const organizationCode = orgCode || userOrgCode

	// Repository
	const projectStateRepository = useRef(new ProjectStateRepository()).current
	const [cacheLoaded, setCacheLoaded] = useState(false)
	// Hover state is only for shortcuts; do not let it rerender the tree.
	const hoveredItemRef = useRef<string | null>(null)
	const setHoveredItem = useCallback((itemId: string | null) => {
		hoveredItemRef.current = itemId
	}, [])
	// 右键菜单关联的文件 ID - 独立于 hoveredItem，用于保持右键菜单打开时的 hover 样式
	const [contextMenuItemId, setContextMenuItemId] = useState<string | null>(null)

	// 展开状态 - 分为用户手动展开和搜索自动展开
	const [localExpandedKeys, setLocalExpandedKeys] = useState<React.Key[]>([]) // 用户手动展开的keys
	const userExpandedKeys = options?.expandedKeys ?? localExpandedKeys
	const setUserExpandedKeys = useMemoizedFn(
		(keys: React.Key[] | ((previous: React.Key[]) => React.Key[])) => {
			const next = typeof keys === "function" ? keys(userExpandedKeys) : keys
			if (options?.onExpandedKeysChange) options.onExpandedKeysChange(next)
			else setLocalExpandedKeys(next)
		},
	)
	const { searchExpandedKeys, setSearchExpandedKeys, resetSearchExpandedKeys } =
		useSearchExpandedKeys({
			searchValue,
			matchedItemPaths,
		})

	// 合并两种展开keys，当有搜索时包含搜索展开的keys
	const expandedKeys = useMemo(() => {
		if (!searchValue) {
			// 没有搜索时，只使用用户手动展开的keys
			return userExpandedKeys
		}
		// 有搜索时，合并用户手动展开和搜索自动展开的keys
		return Array.from(new Set([...userExpandedKeys, ...searchExpandedKeys]))
	}, [userExpandedKeys, searchExpandedKeys, searchValue])

	// 选择状态（树组件的选择，不是文件选择）
	const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])

	// 展开/折叠处理
	const handleExpand = useCallback(
		(newExpandedKeys: React.Key[]) => {
			if (!searchValue) {
				// 没有搜索时，更新用户展开的keys
				setUserExpandedKeys(newExpandedKeys)
			} else {
				// 有搜索时，用户的操作只影响searchExpandedKeys（临时状态）
				// 不更新userExpandedKeys，保持用户的长期展开状态不变
				setSearchExpandedKeys(newExpandedKeys)
			}
		},
		[searchValue, setSearchExpandedKeys],
	)

	// 树节点选择处理
	const handleSelect = (selectedKeys: React.Key[]) => {
		setSelectedKeys(selectedKeys)
	}

	// 加载缓存状态
	useEffect(() => {
		const loadCacheState = async () => {
			if (!enableCache || !organizationCode || !projectId || cacheLoaded) {
				return
			}

			try {
				const cachedState = await projectStateRepository.getProjectState(
					organizationCode,
					projectId,
				)

				if (cachedState?.treeState?.expandedKeys) {
					console.log("🌳 Loading cached tree state:", cachedState.treeState.expandedKeys)

					// 验证缓存的展开状态是否有效（这里先直接恢复，如果需要验证文件夹是否存在可以后续添加）
					try {
						const validExpandedKeys = cachedState.treeState.expandedKeys.filter(
							(key) => {
								// 基本数据验证
								return typeof key === "string" && key.length > 0
							},
						)

						if (
							validExpandedKeys.length !== cachedState.treeState.expandedKeys.length
						) {
							console.warn("⚠️ Some cached expanded keys were invalid, cleaned them")
						}

						// 只恢复用户手动展开的keys
						setUserExpandedKeys(validExpandedKeys)
					} catch (error) {
						console.error("❌ Error processing cached expanded keys:", error)
						// 如果处理缓存数据失败，使用空数组
						setUserExpandedKeys([])
					}
				}

				setCacheLoaded(true)
			} catch (error) {
				console.error("❌ Failed to load cached tree state:", error)
				setCacheLoaded(true)
			}
		}

		loadCacheState()
	}, [enableCache, organizationCode, projectId, cacheLoaded, projectStateRepository])

	// 防抖保存缓存函数
	const { run: debouncedSaveTreeState } = useDebounceFn(
		(keys: React.Key[]) => {
			saveTreeStateToCache(keys)
		},
		{ wait: 500 },
	)

	// 监听 userExpandedKeys 变化并保存到缓存（只保存用户手动展开的keys）
	useEffect(() => {
		// 只有在缓存加载完成后，且有变化时才保存
		if (enableCache && organizationCode && projectId && cacheLoaded) {
			debouncedSaveTreeState(userExpandedKeys)
		}
	}, [
		userExpandedKeys,
		enableCache,
		organizationCode,
		projectId,
		cacheLoaded,
		debouncedSaveTreeState,
	])

	// 保存树形状态到缓存
	const saveTreeStateToCache = useCallback(
		async (keys: React.Key[]) => {
			if (!enableCache || !organizationCode || !projectId) {
				return
			}

			try {
				// 数据清理和验证
				const cleanedKeys = keys
					.map((key) => String(key))
					.filter((key, index, array) => {
						// 去重和去除空值
						return key && key.length > 0 && array.indexOf(key) === index
					})

				const treeState = {
					expandedKeys: cleanedKeys,
				}

				await projectStateRepository.updateTreeState(organizationCode, projectId, treeState)

				console.log("🌳 Tree state saved to cache", treeState)
			} catch (error) {
				console.error("❌ Failed to save tree state to cache:", error)
			}
		},
		[enableCache, organizationCode, projectId, projectStateRepository],
	)

	// 重置所有UI状态
	const resetUI = useCallback(() => {
		setHoveredItem(null)
		setContextMenuItemId(null)
		setUserExpandedKeys([])
		resetSearchExpandedKeys()
		setSelectedKeys([])
		setCacheLoaded(false) // 重置缓存加载状态
	}, [resetSearchExpandedKeys, setHoveredItem])

	// 提供 setExpandedKeys 函数以兼容现有代码
	const setExpandedKeys = useCallback(
		(keys: React.Key[] | ((prev: React.Key[]) => React.Key[])) => {
			if (!searchValue) {
				// 没有搜索时，设置用户展开的keys
				if (typeof keys === "function") {
					setUserExpandedKeys((prev) => keys(prev))
				} else {
					setUserExpandedKeys(keys)
				}
			} else {
				// 有搜索时，设置搜索展开的keys（临时状态）
				if (typeof keys === "function") {
					setSearchExpandedKeys((prev) => keys(prev))
				} else {
					setSearchExpandedKeys(keys)
				}
			}
		},
		[searchValue, setSearchExpandedKeys],
	)

	return {
		// UI 状态
		hoveredItem: hoveredItemRef.current,
		hoveredItemRef,
		setHoveredItem,
		contextMenuItemId,
		setContextMenuItemId,
		expandedKeys, // 合并后的展开keys（用户手动 + 搜索自动）
		setExpandedKeys, // 设置用户手动展开的keys
		selectedKeys,
		setSelectedKeys,
		cacheLoaded,

		// 处理函数
		handleExpand,
		handleSelect,
		resetUI,
		saveTreeStateToCache,
	}
}
