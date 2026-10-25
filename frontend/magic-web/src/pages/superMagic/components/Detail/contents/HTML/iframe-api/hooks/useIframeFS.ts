/**
 * useIframeFS
 *
 * 管理 IframeFSService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。依赖变化时自动重建 service 实例。
 */

import { useEffect, useRef } from "react"
import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import {
	IframeFSService,
	type FSFileItem,
	type UploadFn,
	type SaveContentFn,
	type MkdirFn,
	type DeleteFileFn,
	type DeleteFilesFn,
	type MoveFileFn,
	type RenameFileFn,
	type VerifyFileFn,
	type ConfirmProjectDeleteFn,
} from "../services/IframeFSService"
import type { HTMLAppConfig, HtmlPermissionScope } from "../types"

export interface UseIframeFSOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 回发 iframe 的严格目标源。 */
	targetOrigin: string
	/** Recreate document-owned watches/streams when the iframe Window changes. */
	runtimeRevision?: string | number
	/** HTML 入口文件的 workspace 相对路径 */
	entryPath: string
	/** workspace 文件列表（attachmentList 扁平化后） */
	fileList: FSFileItem[]
	/** Optional app.json (e.g. file aliases); null if not loaded. */
	appConfig: HTMLAppConfig | null
	/** 项目 ID，用于删除等需要 project_id 的操作 */
	projectId?: string
	/** 项目上下文不可用时返回给 iframe 的语义化错误。 */
	projectContextUnavailableError?: string
	/** 创建新文件时的上传函数，复用现有上传链路 */
	uploadFn: UploadFn
	/** 更新已存在文件内容的函数（不重新上传 OSS） */
	saveContentFn: SaveContentFn
	/**
	 * （可选）创建目录函数。写入路径的父目录不存在时，会逐级调用此函数补全目录树。
	 * 不提供时回退到旧行为：仅查 fileList 中已有的目录，找不到则以无 parentId 上传。
	 */
	mkdirFn?: MkdirFn
	/**
	 * （可选）删除文件函数。不提供时 deleteFile 请求将返回错误。
	 */
	deleteFn?: DeleteFileFn
	/**
	 * （可选）批量删除文件函数。用于删除目录及其所有内容。
	 * 不提供时 deleteDir 请求将返回错误。
	 */
	deleteFilesFn?: DeleteFilesFn
	/**
	 * （可选）移动文件/目录函数。不提供时 moveFile 请求将返回错误。
	 */
	moveFileFn?: MoveFileFn
	/**
	 * （可选）重命名文件/目录函数。不提供时 renameFile 请求将返回错误。
	 */
	renameFileFn?: RenameFileFn
	/**
	 * 破坏性操作前按 file_id 反查服务端真实路径。
	 */
	verifyFileFn?: VerifyFileFn
	/**
	 * 删除 appRoot 外 project-scope 文件/目录前的宿主确认。
	 */
	confirmProjectDeleteFn?: ConfirmProjectDeleteFn
	/** 执行高风险能力前的授权检查。 */
	authorizePermission?: (scope: HtmlPermissionScope) => Promise<boolean>
	getFileAccess?: () =>
		import("@/pages/superMagic/fileAccess/fileAccessContext").FileAccessContext | null
}

export interface UseIframeFSReturn {
	/** 分发 MAGIC_FS_* 消息，返回 true 表示已处理 */
	handleFSMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeFS(options: UseIframeFSOptions): UseIframeFSReturn {
	const {
		iframeRef,
		targetOrigin,
		runtimeRevision = 0,
		entryPath,
		fileList,
		appConfig,
		projectId,
		projectContextUnavailableError,
		uploadFn,
		saveContentFn,
		mkdirFn,
		deleteFn,
		deleteFilesFn,
		moveFileFn,
		renameFileFn,
		verifyFileFn,
		confirmProjectDeleteFn,
		authorizePermission,
		getFileAccess,
	} = options

	const serviceRef = useRef<IframeFSService | null>(null)
	// 调用方可能在渲染时创建新的保存函数；稳定代理避免重建 Service 丢失 watch 注册，同时调用最新实现。
	const stableSaveContentFn = useMemoizedFn(saveContentFn)

	// 重建 service：entryPath / appConfig 变化时
	useDeepCompareEffect(() => {
		serviceRef.current?.destroy()
		const target = iframeRef.current?.contentWindow
		let active = true
		serviceRef.current = new IframeFSService({
			postToIframe: (message) => {
				if (active) target?.postMessage(message, targetOrigin)
			},
			entryPath,
			fileList,
			appConfig,
			projectId,
			projectContextUnavailableError,
			uploadFn,
			saveContentFn: stableSaveContentFn,
			mkdirFn,
			deleteFn,
			deleteFilesFn,
			moveFileFn,
			renameFileFn,
			verifyFileFn,
			confirmProjectDeleteFn,
			authorizePermission,
			getFileAccess,
		})

		return () => {
			active = false
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [
		runtimeRevision,
		targetOrigin,
		entryPath,
		appConfig,
		projectId,
		projectContextUnavailableError,
		uploadFn,
		stableSaveContentFn,
		mkdirFn,
		deleteFn,
		deleteFilesFn,
		moveFileFn,
		renameFileFn,
		verifyFileFn,
		confirmProjectDeleteFn,
		authorizePermission,
		getFileAccess,
	])

	// fileList 变化时仅更新内部引用，避免重建 service（会中断 watch 轮询）
	useEffect(() => {
		serviceRef.current?.updateFileList(fileList)
	}, [fileList])

	const handleFSMessage = useMemoizedFn(
		async (type: string, payload: unknown): Promise<boolean> => {
			if (!serviceRef.current) return false
			return serviceRef.current.handleMessage(type, payload)
		},
	)

	return { handleFSMessage }
}
