import { createInstance } from "i18next"
import { useIframeI18n } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeI18n"
import { createElement, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { useIframeFS } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeFS"
import { useIframeLLM } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeLLM"
import { useIframeAgent } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeAgent"
import { useIframeUserInfo } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeUserInfo"
import { useIframeDatabase } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useIframeDatabase"
import { useMagicFiles } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/hooks/useMagicFiles"
import type { TopicStore } from "../../src/pages/superMagic/stores/core/topic"
import type { AgentInfo } from "../../src/pages/superMagic/components/Detail/contents/HTML/iframe-api/types"
import { dependencyCalls, record } from "./host-dependencies"

const fileList = [
	{
		file_id: "data-file",
		relative_file_path: "app/data.txt",
		file_name: "data.txt",
		updated_at: "1",
	},
]
const authorizePermission = async (scope: string) => {
	record("permission.authorize", scope)
	return true
}
const getAgentList = (): AgentInfo[] => {
	record("agent.getAgents")
	return [{ id: "fixture-agent", name: "Fixture Agent", icon: "", color: "", type: "official" }]
}
const getUserInfo = () => {
	record("user.read")
	return {
		name: "Fixture User",
		avatar: "fixture-avatar",
		user_id: "fixture-user",
		organization_code: "fixture-org",
	}
}
const getAuthorization = () => "fixture-authorization"
const getOrganizationCode = () => "fixture-org"

// Read the File received by the real hook so assertions verify transferred bytes,
// rather than merely echoing the original iframe inputs or the upload response.
async function uploadFile(input: {
	file: File
	path: string
	fileSize?: number
	parentId?: string
}) {
	const bytes = Array.from(new Uint8Array(await input.file.arrayBuffer()))
	record("file.upload", input.path, input.file.name, bytes, {
		size: input.file.size,
		type: input.file.type,
		fileSize: input.fileSize,
		parentId: input.parentId,
	})
	return { uploadedRelativeFilePath: input.path }
}

interface HookHostOptions {
	targetOrigin: string
	baseUrl: string
	/** Null deliberately exercises host-less project errors. */
	projectId?: string | null
}

export async function mountHookHost(iframe: HTMLIFrameElement, options: HookHostOptions) {
	const language = createInstance()
	await language.init({
		lng: "zh_CN",
		fallbackLng: false,
		resources: { zh_CN: { translation: {} }, en_US: { translation: {} } },
	})
	const container = document.createElement("div")
	container.hidden = true
	document.body.append(container)
	const root = createRoot(container)
	const firstCall = dependencyCalls.length
	const projectId =
		options.projectId === null ? undefined : (options.projectId ?? "fixture-project")
	let disposeListener: (() => void) | undefined
	let mountTimer: ReturnType<typeof setTimeout> | undefined
	try {
		await new Promise<void>((resolve, reject) => {
			mountTimer = setTimeout(
				() => reject(new Error("Hook host mount timed out after 8 seconds")),
				8000,
			)
			function HookHost() {
				const iframeRef = useRef(iframe)
				const notifyLanguage = useIframeI18n({
					iframeRef,
					targetOrigin: options.targetOrigin,
					i18n: language,
				})
				const fs = useIframeFS({
					iframeRef,
					targetOrigin: options.targetOrigin,
					entryPath: "app/index.html",
					fileList,
					appConfig: null,
					projectId,
					authorizePermission,
					uploadFn: uploadFile,
					saveContentFn: async (input) => {
						record("file.save", input)
					},
				})
				const llm = useIframeLLM({
					iframeRef,
					targetOrigin: options.targetOrigin,
					baseUrl: options.baseUrl,
					getAuthorization,
					getOrganizationCode,
					authorizePermission,
				})
				const agent = useIframeAgent({
					iframeRef,
					targetOrigin: options.targetOrigin,
					projectId,
					enableWriteOperations: true,
					authorizePermission,
					getAgentList,
					createTopicAndSend: async (input) => {
						record("agent.createTopicAndSend", input)
						return { topicId: "fixture-topic" }
					},
					sendMessage: async (input) => {
						record("agent.sendMessage", input)
					},
				})
				const user = useIframeUserInfo({
					iframeRef,
					targetOrigin: options.targetOrigin,
					getUserInfo,
					authorizeUserInfo: async (input) => {
						record("permission.userInfo", input)
						return true
					},
				})
				const database = useIframeDatabase({ iframeRef, projectId })
				const files = useMagicFiles({
					iframeRef,
					targetOrigin: options.targetOrigin,
					projectId,
					selectedProject: projectId
						? { id: projectId, project_mode: "chat", workspace_id: "fixture-workspace" }
						: undefined,
					topicStore: { selectedTopic: { id: "fixture-topic" } } as TopicStore,
					attachmentList: fileList,
					htmlRelativeFolderPath: "app",
					authorizePermission,
					uploadImageFileToProject: uploadFile,
				})

				// Mount real hooks before accepting messages, as the application renderer does.
				useEffect(() => {
					const handleMessage = async (event: MessageEvent) => {
						if (
							event.source !== iframe.contentWindow ||
							event.origin !== options.targetOrigin
						)
							return
						const payload = event.data
						const type = payload?.type
						if (typeof type !== "string") return
						if (type === "MAGIC_I18N_LANG_SUBSCRIBE")
							notifyLanguage("subscribe_ack", payload.requestId)
						else if (type === "FIXTURE_CHANGE_LANGUAGE") {
							await language.changeLanguage(payload.lang)
							iframe.contentWindow?.postMessage(
								{ type: "FIXTURE_LANGUAGE_CHANGED" },
								options.targetOrigin,
							)
						} else if (type.startsWith("MAGIC_FS_"))
							await fs.handleFSMessage(type, payload)
						else if (type.startsWith("MAGIC_LLM_"))
							await llm.handleLLMMessage(type, payload)
						else if (type.startsWith("MAGIC_DB_"))
							await database.handleDatabaseMessage(type, payload)
						else if (type.startsWith("MAGIC_GET_USER_INFO_"))
							await user.handleUserInfoMessage(type, payload)
						else if (
							/^MAGIC_(GET_AGENTS|CREATE_TOPIC_AND_SEND|SEND_MESSAGE)_/.test(type)
						)
							await agent.handleAgentMessage(type, payload)
						else if (type === "MAGIC_UPLOAD_FILES_REQUEST")
							await files.handleMagicUploadFiles(payload)
						else if (type === "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST")
							await files.handleMagicAddFilesToMessage(payload)
						else if (type === "MAGIC_DOWNLOAD_FILES_REQUEST")
							await files.handleMagicDownloadFiles(payload)
					}
					window.addEventListener("message", handleMessage)
					disposeListener = () => window.removeEventListener("message", handleMessage)
					resolve()
					return disposeListener
				}, [agent, database, files, fs, llm, user, notifyLanguage])
				return null
			}
			root.render(createElement(HookHost))
		})
	} catch (error) {
		disposeListener?.()
		root.unmount()
		container.remove()
		throw error
	} finally {
		clearTimeout(mountTimer)
	}
	return {
		get dependencyCalls() {
			return dependencyCalls.slice(firstCall)
		},
		dispose() {
			disposeListener?.()
			root.unmount()
			container.remove()
		},
	}
}
