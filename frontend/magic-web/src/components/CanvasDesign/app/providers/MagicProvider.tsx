import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"
import type {
	CanvasDesignMethods,
	AiAbilityAvailability,
	EstimateVideoPointsResponse,
	ImageModelItem,
	MagicPermissions,
	GetConvertHightConfigResponse,
	VideoModelItem,
	GenerateVideoRequest,
} from "../../public/magic-types"
import type {
	MentionDataServiceCtor,
	MentionExtensionCtor,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelRenderer,
} from "../../public/props"
import { useOptionalCanvas } from "./CanvasProvider"
import { VideoPointsEstimateCache } from "./video-points-estimate.cache"
import { isSeedanceComplianceAvailable } from "../../ui/seedanceComplianceAvailability"

/**
 * Magic Context - 用于与外部通信
 * 职责：提供外部数据获取方法，如获取模型列表等
 */
interface MagicContextValue {
	/**
	 * 方法集合（包含 storage 方法）
	 */
	methods?: CanvasDesignMethods
	/**
	 * Magic 权限配置
	 */
	permissions?: MagicPermissions
	/**
	 * 生图模型列表
	 */
	imageModelList: ImageModelItem[]
	/**
	 * 生视频模型列表
	 */
	videoModelList: VideoModelItem[]
	/**
	 * 是否正在加载模型列表
	 */
	isLoadingImageModelList: boolean
	/**
	 * 是否正在加载视频模型列表
	 */
	isLoadingVideoModelList: boolean
	/**
	 * 转高清配置
	 */
	convertHightConfig: GetConvertHightConfigResponse | null
	/** 画布 AI 能力可用性 */
	aiAbilityAvailability: AiAbilityAvailability | null
	/** 宿主是否提供了统一 AI 能力门禁接口。 */
	hasAiAbilityAvailabilityProvider: boolean
	/** 统一 AI 能力门禁是否已经成功返回。 */
	isAiAbilityAvailabilityReady: boolean
	/**
	 * 是否正在加载转高清配置
	 */
	isLoadingConvertHightConfig: boolean
	/**
	 * 项目附件树（根节点列表），用于 @ / 参考资源面板
	 */
	projectAttachmentMentionTree?: ProjectAttachmentMentionNode[]
	/**
	 * `@文件` 默认进入的项目目录 id，通常为当前设计项目目录
	 */
	defaultProjectAttachmentFolderId?: string
	/**
	 * `@文件` 默认进入的项目目录名称，用于面包屑显示
	 */
	defaultProjectAttachmentFolderName?: string
	/**
	 * Mention 数据服务构造函数，由外部传入以实现隔离
	 */
	mentionDataServiceCtor?: MentionDataServiceCtor
	/**
	 * Mention 扩展类（通过依赖注入传入，实现组件隔离）
	 * 子组件使用此类创建配置好的实例
	 */
	mentionExtension?: MentionExtensionCtor
	/**
	 * 项目侧资源选择面板渲染器（通过依赖注入传入，实现组件隔离）
	 */
	referenceResourcePanelRenderer?: ReferenceResourcePanelRenderer
	getCachedVideoPointsEstimate: (signature: string) => EstimateVideoPointsResponse | undefined
	getVideoPointsEstimate: (options: {
		signature: string
		request: GenerateVideoRequest
	}) => Promise<EstimateVideoPointsResponse>
}

const MagicContext = createContext<MagicContextValue | undefined>(undefined)

interface MagicProviderProps {
	children: ReactNode
	methods?: CanvasDesignMethods
	permissions?: MagicPermissions
	projectAttachmentMentionTree?: ProjectAttachmentMentionNode[]
	defaultProjectAttachmentFolderId?: string
	defaultProjectAttachmentFolderName?: string
	mentionDataServiceCtor?: MentionDataServiceCtor
	mentionExtension?: MentionExtensionCtor
	referenceResourcePanelRenderer?: ReferenceResourcePanelRenderer
	/** 宿主 UI 语言，仅用于在语言切换时重拉模型列表 */
	hostUiLocale?: string
	/** 宿主业务作用域变化时清空视频积分预估缓存 */
	videoPointsEstimateCacheScope?: string
}

export function MagicProvider({
	children,
	methods,
	permissions,
	projectAttachmentMentionTree,
	defaultProjectAttachmentFolderId,
	defaultProjectAttachmentFolderName,
	mentionDataServiceCtor,
	mentionExtension,
	referenceResourcePanelRenderer,
	hostUiLocale,
	videoPointsEstimateCacheScope,
}: MagicProviderProps) {
	const canvas = useOptionalCanvas()
	const [, forcePermissionUpdate] = useState(0)
	useEffect(() => {
		if (!canvas) return
		return canvas.eventEmitter.on("permission:changed", () => {
			forcePermissionUpdate((value) => value + 1)
		})
	}, [canvas])
	const canGenerate = canvas?.permissionManager?.can("sideEffect.generate") ?? false
	const [imageModelList, setImageModelList] = useState<ImageModelItem[]>([])
	const [videoModelList, setVideoModelList] = useState<VideoModelItem[]>([])
	const [isLoadingImageModelList, setIsLoadingImageModelList] = useState(false)
	const [isLoadingVideoModelList, setIsLoadingVideoModelList] = useState(false)
	const [convertHightConfig, setConvertHightConfig] =
		useState<GetConvertHightConfigResponse | null>(null)
	const [aiAbilityAvailability, setAiAbilityAvailability] =
		useState<AiAbilityAvailability | null>(null)
	const [isAiAbilityAvailabilityReady, setIsAiAbilityAvailabilityReady] = useState(false)
	const [isLoadingConvertHightConfig, setIsLoadingConvertHightConfig] = useState(false)
	const videoPointsEstimateCacheRef = useRef(new VideoPointsEstimateCache())

	const getImageModelList = methods?.getImageModelList
	const getVideoModelList = methods?.getVideoModelList
	const getConvertHightConfig = methods?.getConvertHightConfig
	const getAiAbilityAvailability = methods?.getAiAbilityAvailability
	const estimateVideoPoints = methods?.estimateVideoPoints
	const hasAiAbilityAvailabilityProvider = Boolean(getAiAbilityAvailability)

	// 挂载及宿主语言切换时重新拉取模型列表（无生成能力时跳过）
	useEffect(() => {
		if (!canGenerate) {
			setImageModelList([])
			setVideoModelList([])
			setIsLoadingImageModelList(false)
			setIsLoadingVideoModelList(false)
			return
		}

		let cancelled = false

		const fetchModelList = async () => {
			if (!getImageModelList) return

			setIsLoadingImageModelList(true)
			setImageModelList([])
			try {
				const models = await getImageModelList()
				if (!cancelled) setImageModelList(models)
			} catch (error) {
				console.error("Failed to fetch image model list:", error)
				if (!cancelled) setImageModelList([])
			} finally {
				if (!cancelled) setIsLoadingImageModelList(false)
			}
		}

		const fetchVideoModelList = async () => {
			if (!getVideoModelList) return

			setIsLoadingVideoModelList(true)
			setVideoModelList([])
			try {
				const models = await getVideoModelList()
				if (!cancelled) setVideoModelList(models)
			} catch (error) {
				console.error("Failed to fetch video model list:", error)
				if (!cancelled) setVideoModelList([])
			} finally {
				if (!cancelled) setIsLoadingVideoModelList(false)
			}
		}

		void fetchModelList()
		void fetchVideoModelList()

		return () => {
			cancelled = true
		}
	}, [canGenerate, getImageModelList, getVideoModelList, hostUiLocale])

	// AI 能力可用性只在能力变更时拉取，避免宿主页面普通重渲染导致重复请求。
	// Seedance 合规菜单在只读画布上也会出现，因此不能只在具备生成权限时请求。
	useEffect(() => {
		let cancelled = false

		const fetchConvertHightConfig = async () => {
			if (!getAiAbilityAvailability && !getConvertHightConfig) {
				setIsAiAbilityAvailabilityReady(false)
				return
			}

			setIsLoadingConvertHightConfig(true)
			setIsAiAbilityAvailabilityReady(false)
			if (getAiAbilityAvailability) setAiAbilityAvailability(null)
			setConvertHightConfig(null)
			try {
				if (getAiAbilityAvailability) {
					const availability = await getAiAbilityAvailability()
					if (!cancelled) {
						setAiAbilityAvailability(availability)
						setConvertHightConfig(availability.abilities.image_convert_high)
						setIsAiAbilityAvailabilityReady(true)
					}
					return
				}

				const config = await getConvertHightConfig?.()
				if (!cancelled && config) setConvertHightConfig(config)
			} catch (error) {
				console.error("Failed to fetch convert hight config:", error)
				if (!cancelled) {
					setAiAbilityAvailability(null)
					setConvertHightConfig(null)
					setIsAiAbilityAvailabilityReady(false)
				}
			} finally {
				if (!cancelled) setIsLoadingConvertHightConfig(false)
			}
		}

		void fetchConvertHightConfig()

		return () => {
			cancelled = true
		}
	}, [getAiAbilityAvailability, getConvertHightConfig])

	useEffect(() => {
		videoPointsEstimateCacheRef.current.clear()
	}, [videoPointsEstimateCacheScope])

	// Konva 节点与名称标签读不到 React hook，能力结果确定后同步到 Canvas。
	useEffect(() => {
		if (!canvas) return
		const enabled =
			hasAiAbilityAvailabilityProvider &&
			isAiAbilityAvailabilityReady &&
			isSeedanceComplianceAvailable(aiAbilityAvailability)
		canvas.setSeedanceComplianceEnabled(enabled)
	}, [
		aiAbilityAvailability,
		canvas,
		hasAiAbilityAvailabilityProvider,
		isAiAbilityAvailabilityReady,
	])

	const getCachedVideoPointsEstimate = useCallback((signature: string) => {
		return videoPointsEstimateCacheRef.current.get(signature)
	}, [])

	const getVideoPointsEstimate = useCallback(
		async (options: {
			signature: string
			request: GenerateVideoRequest
		}): Promise<EstimateVideoPointsResponse> => {
			return videoPointsEstimateCacheRef.current.getOrRequest({
				...options,
				estimateVideoPoints,
			})
		},
		[estimateVideoPoints],
	)

	const value: MagicContextValue = useMemo(
		() => ({
			methods,
			permissions,
			imageModelList,
			videoModelList,
			isLoadingImageModelList,
			isLoadingVideoModelList,
			convertHightConfig,
			aiAbilityAvailability,
			hasAiAbilityAvailabilityProvider,
			isAiAbilityAvailabilityReady,
			isLoadingConvertHightConfig,
			projectAttachmentMentionTree,
			defaultProjectAttachmentFolderId,
			defaultProjectAttachmentFolderName,
			mentionDataServiceCtor,
			mentionExtension,
			referenceResourcePanelRenderer,
			getCachedVideoPointsEstimate,
			getVideoPointsEstimate,
		}),
		[
			methods,
			permissions,
			imageModelList,
			videoModelList,
			isLoadingImageModelList,
			isLoadingVideoModelList,
			convertHightConfig,
			aiAbilityAvailability,
			hasAiAbilityAvailabilityProvider,
			isAiAbilityAvailabilityReady,
			isLoadingConvertHightConfig,
			projectAttachmentMentionTree,
			defaultProjectAttachmentFolderId,
			defaultProjectAttachmentFolderName,
			mentionDataServiceCtor,
			mentionExtension,
			referenceResourcePanelRenderer,
			getCachedVideoPointsEstimate,
			getVideoPointsEstimate,
		],
	)

	return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>
}

export function useMagic() {
	const context = useContext(MagicContext)
	if (context === undefined) {
		throw new Error("useMagic must be used within a MagicProvider")
	}
	return context
}
