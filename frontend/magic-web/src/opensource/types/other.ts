export interface Operator {
	id: string
	real_name: string
	avatar: string
	description: string
	position: string
	department: null
}

export interface ListData<T> {
	items: T[]
	next_page: boolean
	page: number
}

export interface ListDataWithTotal<T> {
	list: T[]
	total: number
	page: number
	page_size: number
}

/** 分页参数 */
export interface PageParams {
	page?: number
	page_size?: number
}
