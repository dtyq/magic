export interface TableSchema {
	name: string
	schema: string
	// version: number
}

export interface DatabaseConfig {
	name: string
	version: number
}

export interface IRepository {
	getTableSchema(): TableSchema
}
