export interface WorkspaceFile {
	children: WorkspaceFile[]
	file_id: string
	task_id: string
	project_id: string
	file_type: string
	file_name: string
	file_extension: string
	file_key: string
	file_size: number
	relative_file_path: string
	file_url: string
	is_hidden: boolean
	type: "file"
}

export interface WorkspaceFolder {
	file_name: string
	relative_file_path: string
	file_id: string
	type: "directory"
	is_directory: boolean
	is_hidden: boolean
	children: (WorkspaceFolder | WorkspaceFile)[]
	metadata?: any
}
