export interface RouteParams {
	/** 路由别名 */
	name: string
	/** 路径参数 */
	params?: Record<string, string | number | undefined>
	/** 查询参数 */
	query?: Record<string, string | number>
	state?: any
	/** 集群编码 */
	// clusterCode?: string
}

export type Params<Key extends string = string> = {
	readonly [key in Key]: string | undefined
}
