export interface Application {
	id: string
	name: string
	description: string
	logo: [
		{
			key: string
			name: string
			uid: string
			url: string
		},
	]
	code: string
	owning_organization: string
	status: 1
	redirect_url: string
	category_name: string
	category_code: string
	source: 3
	first_letter_name: string
	type: 0
	home_page: string
	enable_status: 0 | 1
	visibility: 0 | 1
	is_micro: 0 | 1
}
