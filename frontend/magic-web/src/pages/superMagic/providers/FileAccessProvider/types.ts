/** Frontend operation constraints; existing resource permissions still apply. */
export interface FileAccessState {
	download: boolean
	preview: boolean
	share: boolean
	view: boolean
	export: boolean
}
export type FileAccessOverrides = Partial<Readonly<FileAccessState>>

/** Presentation options do not grant file permissions. */
export interface FileActionOptions {
	copyTo: boolean
	moveTo: boolean
	shareTopic: boolean
	createNewTopic: boolean
	fullscreen: boolean
	versionHistory: boolean
	shareInReadOnly: boolean
}
export interface FileAccessConfig {
	permissions?: FileAccessOverrides
	options?: Partial<Readonly<FileActionOptions>>
}
export interface FileAccessContextValue {
	readonly permissions: Readonly<FileAccessState>
	readonly options: Readonly<FileActionOptions>
	/** Internal scope marker; consumers always receive complete defaults. */
	readonly isScoped: boolean
}
