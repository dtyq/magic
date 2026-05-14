/**
 * useIframeFS
 *
 * 管理 IframeFSService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。依赖变化时自动重建 service 实例。
 */

import { useRef } from "react"
import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import {
	IframeFSService,
	type FSFileItem,
	type UploadFn,
	type SaveContentFn,
	type MkdirFn,
} from "../services/IframeFSService"
import type { HTMLAppConfig } from "../types"

export interface UseIframeFSOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** HTML 入口文件的 workspace 相对路径 */
	entryPath: string
	/** workspace 文件列表（attachmentList 扁平化后） */
	fileList: FSFileItem[]
	/** Optional app.json (e.g. file aliases); null if not loaded. */
	appConfig: HTMLAppConfig | null
	/** 创建新文件时的上传函数，复用现有上传链路 */
	uploadFn: UploadFn
	/** 更新已存在文件内容的函数（不重新上传 OSS） */
	saveContentFn: SaveContentFn
	/**
	 * （可选）创建目录函数。写入路径的父目录不存在时，会逐级调用此函数补全目录树。
	 * 不提供时回退到旧行为：仅查 fileList 中已有的目录，找不到则以无 parentId 上传。
	 */
	mkdirFn?: MkdirFn
}

export interface UseIframeFSReturn {
	/** 分发 MAGIC_FS_* 消息，返回 true 表示已处理 */
	handleFSMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeFS(options: UseIframeFSOptions): UseIframeFSReturn {
	const { iframeRef, entryPath, fileList, appConfig, uploadFn, saveContentFn, mkdirFn } = options

	const serviceRef = useRef<IframeFSService | null>(null)

	// postToIframe 是稳定引用，内部每次通过 ref 取最新的 iframe window
	const postToIframe = useMemoizedFn((message: object) => {
		iframeRef.current?.contentWindow?.postMessage(message, "*")
	})

	// 重建 service：entryPath / appConfig 变化时
	useDeepCompareEffect(() => {
		serviceRef.current?.destroy()
		serviceRef.current = new IframeFSService({
			postToIframe,
			entryPath,
			fileList,
			appConfig,
			uploadFn,
			saveContentFn,
			mkdirFn,
		})

		return () => {
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [entryPath, appConfig])

	// fileList 变化时仅更新内部引用，避免重建 service（会中断 watch 轮询）
	useDeepCompareEffect(() => {
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
