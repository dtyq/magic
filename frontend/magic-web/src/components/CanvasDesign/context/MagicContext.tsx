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
	EstimateVideoPointsResponse,
	ImageModelItem,
	MagicPermissions,
	GetConvertHightConfigResponse,
	VideoModelItem,
	GenerateVideoRequest,
} from "../types.magic"
import type {
	MentionDataServiceCtor,
	MentionExtensionCtor,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelRenderer,
} from "../types"

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
	/** 只读画布下不请求模型列表与转高清配置 */
	readonly?: boolean
	/** 宿主 UI 语言，仅用于在语言切换时重拉模型列表 */
	hostUiLocale?: string
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
	readonly = false,
	hostUiLocale,
}: MagicProviderProps) {
	const [imageModelList, setImageModelList] = useState<ImageModelItem[]>([])
	const [videoModelList, setVideoModelList] = useState<VideoModelItem[]>([])
	const [isLoadingImageModelList, setIsLoadingImageModelList] = useState(false)
	const [isLoadingVideoModelList, setIsLoadingVideoModelList] = useState(false)
	const [convertHightConfig, setConvertHightConfig] =
		useState<GetConvertHightConfigResponse | null>(null)
	const [isLoadingConvertHightConfig, setIsLoadingConvertHightConfig] = useState(false)
	const videoPointsEstimateCacheRef = useRef(new Map<string, EstimateVideoPointsResponse>())
	const videoPointsEstimatePromiseRef = useRef(
		new Map<string, Promise<EstimateVideoPointsResponse>>(),
	)

	const getImageModelList = methods?.getImageModelList
	const getVideoModelList = methods?.getVideoModelList
	const getConvertHightConfig = methods?.getConvertHightConfig
	const estimateVideoPoints = methods?.estimateVideoPoints

	// 挂载及宿主语言切换时重新拉取模型列表（只读模式跳过）
	useEffect(() => {
		if (readonly) return

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
	}, [readonly, getImageModelList, getVideoModelList, hostUiLocale])

	// 转高清配置只在能力变更时拉取，避免宿主页面普通重渲染导致重复请求
	useEffect(() => {
		if (readonly) return

		let cancelled = false

		const fetchConvertHightConfig = async () => {
			if (!getConvertHightConfig) return

			setIsLoadingConvertHightConfig(true)
			try {
				const config = await getConvertHightConfig()
				if (!cancelled) setConvertHightConfig(config)
			} catch (error) {
				console.error("Failed to fetch convert hight config:", error)
				if (!cancelled) setConvertHightConfig(null)
			} finally {
				if (!cancelled) setIsLoadingConvertHightConfig(false)
			}
		}

		void fetchConvertHightConfig()

		return () => {
			cancelled = true
		}
	}, [readonly, getConvertHightConfig])

	useEffect(() => {
		videoPointsEstimateCacheRef.current.clear()
		videoPointsEstimatePromiseRef.current.clear()
	}, [estimateVideoPoints])

	const getCachedVideoPointsEstimate = useCallback((signature: string) => {
		return videoPointsEstimateCacheRef.current.get(signature)
	}, [])

	const getVideoPointsEstimate = useCallback(
		async (options: {
			signature: string
			request: GenerateVideoRequest
		}): Promise<EstimateVideoPointsResponse> => {
			const cachedEstimate = videoPointsEstimateCacheRef.current.get(options.signature)
			if (cachedEstimate) return cachedEstimate

			const pendingEstimate = videoPointsEstimatePromiseRef.current.get(options.signature)
			if (pendingEstimate) return pendingEstimate

			if (!estimateVideoPoints) throw new Error("estimateVideoPoints is unavailable")

			const requestPromise = estimateVideoPoints(options.request)
				.then((estimate) => {
					videoPointsEstimateCacheRef.current.set(options.signature, estimate)
					return estimate
				})
				.finally(() => {
					videoPointsEstimatePromiseRef.current.delete(options.signature)
				})

			videoPointsEstimatePromiseRef.current.set(options.signature, requestPromise)
			return requestPromise
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
