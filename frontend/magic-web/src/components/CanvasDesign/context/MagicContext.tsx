import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import { useMount } from "ahooks"
import type {
	CanvasDesignMethods,
	ImageModelItem,
	MagicPermissions,
	GetConvertHightConfigResponse,
} from "../types.magic"
import type { ImageFileForMention, MentionDataServiceCtor } from "../types"

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
	 * 是否正在加载模型列表
	 */
	isLoadingImageModelList: boolean
	/**
	 * 转高清配置
	 */
	convertHightConfig: GetConvertHightConfigResponse | null
	/**
	 * 是否正在加载转高清配置
	 */
	isLoadingConvertHightConfig: boolean
	/**
	 * 项目 images 目录下的图片列表，用于 @ 面板
	 */
	imageFilesForMention?: ImageFileForMention[]
	/**
	 * Mention 数据服务构造函数，由外部传入以实现隔离
	 */
	mentionDataServiceCtor?: MentionDataServiceCtor
	/**
	 * Mention 扩展类（通过依赖注入传入，实现组件隔离）
	 * 子组件使用此类创建配置好的实例
	 */
	mentionExtension?: unknown
}

const MagicContext = createContext<MagicContextValue | undefined>(undefined)

interface MagicProviderProps {
	children: ReactNode
	methods?: CanvasDesignMethods
	permissions?: MagicPermissions
	imageFilesForMention?: ImageFileForMention[]
	mentionDataServiceCtor?: MentionDataServiceCtor
	mentionExtension?: unknown
}

export function MagicProvider({
	children,
	methods,
	permissions,
	imageFilesForMention,
	mentionDataServiceCtor,
	mentionExtension,
}: MagicProviderProps) {
	const [imageModelList, setImageModelList] = useState<ImageModelItem[]>([])
	const [isLoadingImageModelList, setIsLoadingImageModelList] = useState(false)
	const [convertHightConfig, setConvertHightConfig] =
		useState<GetConvertHightConfigResponse | null>(null)
	const [isLoadingConvertHightConfig, setIsLoadingConvertHightConfig] = useState(false)

	// 在挂载时请求一次模型列表和转高清配置
	useMount(() => {
		const fetchModelList = async () => {
			if (methods?.getImageModelList) {
				setIsLoadingImageModelList(true)
				try {
					const models = await methods.getImageModelList()
					setImageModelList(models)
				} catch (error) {
					console.error("Failed to fetch image model list:", error)
					setImageModelList([])
				} finally {
					setIsLoadingImageModelList(false)
				}
			}
		}

		const fetchConvertHightConfig = async () => {
			if (methods?.getConvertHightConfig) {
				setIsLoadingConvertHightConfig(true)
				try {
					const config = await methods.getConvertHightConfig()
					setConvertHightConfig(config)
				} catch (error) {
					console.error("Failed to fetch convert hight config:", error)
					setConvertHightConfig(null)
				} finally {
					setIsLoadingConvertHightConfig(false)
				}
			}
		}

		fetchModelList()
		fetchConvertHightConfig()
	})

	const value: MagicContextValue = useMemo(
		() => ({
			methods,
			permissions,
			imageModelList,
			isLoadingImageModelList,
			convertHightConfig,
			isLoadingConvertHightConfig,
			imageFilesForMention,
			mentionDataServiceCtor,
			mentionExtension,
		}),
		[
			methods,
			permissions,
			imageModelList,
			isLoadingImageModelList,
			convertHightConfig,
			isLoadingConvertHightConfig,
			imageFilesForMention,
			mentionDataServiceCtor,
			mentionExtension,
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
