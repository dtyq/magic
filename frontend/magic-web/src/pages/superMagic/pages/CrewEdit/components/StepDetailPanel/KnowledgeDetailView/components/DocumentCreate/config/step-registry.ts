import { lazy } from "react"
import { DOCUMENT_TYPES } from "../constants"
import type { StepRegistry } from "../types"

/**
 * 步骤组件注册表
 *
 * 配置驱动的步骤组件映射，支持动态导入和按需加载
 *
 * 添加新文档类型的步骤：
 * 1. 在此注册表中添加对应的文档类型
 * 2. 定义每个步骤的组件和对应的 store
 * 3. 无需修改主组件代码
 *
 * @example
 * // 添加新的文档类型
 * [DOCUMENT_TYPES.NEW_TYPE]: {
 *   1: {
 *     component: lazy(() => import('./new-type/steps/Step1')),
 *     storeKey: 'newTypeStore'
 *   },
 * }
 */
export const STEP_COMPONENT_REGISTRY: StepRegistry = {
	[DOCUMENT_TYPES.LOCAL]: {
		1: {
			component: lazy(() =>
				import("../document-types/local/steps/UploadFilesStep").then((m) => ({
					default: m.UploadFilesStep,
				})),
			),
			storeKey: "localDocumentStore",
		},
		2: {
			component: lazy(() =>
				import("../document-types/local/steps/StrategyConfigStep").then((m) => ({
					default: m.StrategyConfigStep,
				})),
			),
			storeKey: "localDocumentStore",
		},
		3: {
			component: lazy(() =>
				import("../document-types/local/steps/ChunkPreviewStep").then((m) => ({
					default: m.ChunkPreviewStep,
				})),
			),
			storeKey: "localDocumentStore",
		},
		4: {
			component: lazy(() =>
				import("../document-types/local/steps/DataProcessingStep").then((m) => ({
					default: m.DataProcessingStep,
				})),
			),
			storeKey: "localDocumentStore",
		},
	},
	[DOCUMENT_TYPES.CUSTOM]: {
		1: {
			component: lazy(() =>
				import("../document-types/custom/steps/TextInputStep").then((m) => ({
					default: m.TextInputStep,
				})),
			),
			storeKey: "customContentStore",
		},
		2: {
			component: lazy(() =>
				import("../document-types/custom/steps/StrategyConfigStep").then((m) => ({
					default: m.StrategyConfigStep,
				})),
			),
			storeKey: "customContentStore",
		},
		3: {
			component: lazy(() =>
				import("../document-types/custom/steps/DataProcessingStep").then((m) => ({
					default: m.DataProcessingStep,
				})),
			),
			storeKey: "customContentStore",
		},
	},
	[DOCUMENT_TYPES.PROJECT]: {
		1: {
			component: lazy(() =>
				import("../document-types/project/steps/ProjectSelectionStep").then((m) => ({
					default: m.ProjectSelectionStep,
				})),
			),
			storeKey: "projectDocumentStore",
		},
		2: {
			component: lazy(() =>
				import("../document-types/project/steps/StrategyConfigStep").then((m) => ({
					default: m.StrategyConfigStep,
				})),
			),
			storeKey: "projectDocumentStore",
		},
		3: {
			component: lazy(() =>
				import("../document-types/project/steps/DataProcessingStep").then((m) => ({
					default: m.DataProcessingStep,
				})),
			),
			storeKey: "projectDocumentStore",
		},
	},
	[DOCUMENT_TYPES.WIKI]: {
		1: {
			component: lazy(() =>
				import("../document-types/wiki/steps/WikiSelectionStep").then((m) => ({
					default: m.WikiSelectionStep,
				})),
			),
			storeKey: "wikiDocumentStore",
		},
		2: {
			component: lazy(() =>
				import("../document-types/wiki/steps/StrategyConfigStep").then((m) => ({
					default: m.StrategyConfigStep,
				})),
			),
			storeKey: "wikiDocumentStore",
		},
		3: {
			component: lazy(() =>
				import("../document-types/wiki/steps/DataProcessingStep").then((m) => ({
					default: m.DataProcessingStep,
				})),
			),
			storeKey: "wikiDocumentStore",
		},
	},
}

/**
 * 获取指定文档类型和步骤的组件配置
 *
 * @param documentType - 文档类型
 * @param step - 步骤编号
 * @returns 步骤组件配置，如果不存在返回 null
 */
export function getStepComponentConfig(documentType: string, step: number) {
	return (
		STEP_COMPONENT_REGISTRY[documentType as keyof typeof STEP_COMPONENT_REGISTRY]?.[step] ??
		null
	)
}

/**
 * 检查指定文档类型和步骤是否有对应的组件
 *
 * @param documentType - 文档类型
 * @param step - 步骤编号
 * @returns 是否存在对应的步骤组件
 */
export function hasStepComponent(documentType: string, step: number): boolean {
	return !!getStepComponentConfig(documentType, step)
}
