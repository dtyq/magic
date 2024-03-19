import { makeAutoObservable, runInAction } from "mobx"
import type { PathNode } from "./types"
import { userStore } from "@/opensource/models/user"
import userInfoService from "@/opensource/services/userInfo"
import { StructureUserItem } from "@/opensource/types/organization"
import { contactStore } from "@/opensource/stores/contact"

class PathNodesStore {
	pathNodes: PathNode[] = []
	isLoading = false
	lastFetchTime = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setPathNodes(pathNodes: PathNode[]) {
		this.pathNodes = pathNodes
	}

	setIsLoading(isLoading: boolean) {
		this.isLoading = isLoading
	}

	/**
	 * 初始化加载 - 如果有缓存则立即返回，同时触发后台更新
	 */
	async initialize() {
		if (this.pathNodes.length > 0) {
			// 有缓存，触发静默更新
			this.fetchAndUpdate(true)
			return this.pathNodes
		}

		// 无缓存，正常加载
		return this.fetchAndUpdate(false)
	}

	/**
	 * 获取最新数据并更新
	 * @param silent - 是否静默更新（不显示 loading 状态）
	 */
	async fetchAndUpdate(silent = false) {
		if (!silent) {
			runInAction(() => {
				this.isLoading = true
			})
		}

		try {
			const userId = userStore.user.userInfo?.user_id
			if (!userId) {
				return this.pathNodes
			}

			// 获取用户信息
			const userInfos: StructureUserItem[] = await userInfoService.fetchUserInfos([userId], 2)
			const userInfo = userInfos[0]

			if (!userInfo?.path_nodes) {
				return this.pathNodes
			}

			// 提取部门 IDs
			const departmentIds = Array.from(
				(userInfo.path_nodes ?? []).reduce((acc: Set<string>, node: any) => {
					const path = node.path.split("/")
					path.forEach((p: string) => acc.add(p))
					return acc
				}, new Set<string>()),
			)

			// 获取部门信息
			const departmentInfos = await contactStore.getDepartmentInfos(departmentIds, 1, true)

			// 处理 path nodes
			const processedPathNodes: PathNode[] = userInfo.path_nodes
				.filter((item: any) => item.department_id !== "-1")
				.map((node: any) => {
					const departmentPaths = node.path
						.split("/")
						.filter((path: string) => path !== "-1")

					const pathNodes = departmentPaths.map((path: string) => ({
						id: path,
						name: departmentInfos?.find((d) => d?.department_id === path)?.name || "",
					}))

					return {
						id: node.department_id,
						name: node.department_name,
						departmentPath: node.path,
						pathNodes,
						departmentPathName: node.path
							.split("/")
							.slice(1)
							.map(
								(p: string) =>
									departmentInfos?.find((d: any) => d?.department_id === p)?.name,
							)
							.filter(Boolean)
							.join("-"),
					}
				})

			runInAction(() => {
				this.pathNodes = processedPathNodes
				this.lastFetchTime = Date.now()
			})

			return processedPathNodes
		} catch (error) {
			console.error("Failed to fetch path nodes:", error)
			return this.pathNodes
		} finally {
			if (!silent) {
				runInAction(() => {
					this.isLoading = false
				})
			}
		}
	}

	/**
	 * 清空数据
	 */
	reset() {
		this.pathNodes = []
		this.isLoading = false
		this.lastFetchTime = 0
	}
}

export default new PathNodesStore()
