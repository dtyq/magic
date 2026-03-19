type LogoType = {
	key: string
	name: string
	uid: string
	path: string
	platform: string
	url: string
	expires: number
}

type AppDataType = {
	id: string
	name: string
	description: string
	logo: LogoType[]
	code: string
	owning_organization: string
	status: number
	redirect_url: string
	category_name: string
	category_code: string
	source: number
	first_letter_name: string
	type: number
	home_page: string
	enable_status: number
	visibility: number
	platforms: string
	is_micro: number
}

// 如果数据是在一个数组中的形式，如下定义数组类型
export type AppDataArrayType = AppDataType[]
