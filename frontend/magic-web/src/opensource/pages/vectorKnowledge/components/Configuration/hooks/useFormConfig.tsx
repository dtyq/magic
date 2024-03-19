import { Form } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { FragmentConfig, ConfigFormValues } from "../../../types"
import { DEFAULT_FORM_VALUES, convertBooleanToPreprocessingRules } from "./formUtils"
import { SegmentationMode, ParentBlockMode } from "../../../constant"
import { processConfigSeparators } from "../../../utils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export function useFormConfig() {
	const { t } = useTranslation("flow")
	const [form] = Form.useForm<ConfigFormValues>()

	// 使用Form.useWatch钩子实时监听表单字段的变化
	const segmentMode = Form.useWatch(["fragment_config", "mode"], form)
	const parentBlockType = Form.useWatch(["fragment_config", "parent_child", "parent_mode"], form)

	// 分段模式切换处理
	const handleSegmentModeChange = useMemoizedFn((mode: SegmentationMode) => {
		resetSegmentSettings(
			mode === SegmentationMode.General
				? SegmentationMode.ParentChild
				: SegmentationMode.General,
		)
		form.setFieldValue(["fragment_config", "mode"], mode)
	})

	// 父块模式切换处理
	const handleParentBlockTypeChange = useMemoizedFn((type: ParentBlockMode) => {
		form.setFieldValue(["fragment_config", "parent_child", "parent_mode"], type)
	})

	// 分段设置重置
	const resetSegmentSettings = useMemoizedFn((mode: SegmentationMode) => {
		let newFragmentConfig = {}
		const fragmentConfig = form.getFieldValue(["fragment_config"])
		if (mode === SegmentationMode.General) {
			newFragmentConfig = {
				...fragmentConfig,
				normal: DEFAULT_FORM_VALUES.fragment_config.normal,
			}
		} else {
			newFragmentConfig = {
				...fragmentConfig,
				parent_child: DEFAULT_FORM_VALUES.fragment_config.parent_child,
			}
		}
		form.setFieldsValue({
			fragment_config: newFragmentConfig,
		})
	})

	// 处理表单数据并转换为API所需格式
	const processFormData = useMemoizedFn(async () => {
		try {
			// 验证表单并获取值
			const formValues = await form.validateFields()

			// 提取布尔值并转换为API所需的数组格式
			const { normal, parent_child, ...restFragmentConfig } = formValues.fragment_config
			const {
				replace_spaces: normalReplaceSpaces,
				remove_urls: normalRemoveUrls,
				...restNormal
			} = normal || {}
			const {
				replace_spaces: parentChildReplaceSpaces,
				remove_urls: parentChildRemoveUrls,
				...restParentChild
			} = parent_child || {}

			// 处理所有分隔符中的转义字符
			const processedConfig = processConfigSeparators({
				normal: restNormal,
				parent_child: restParentChild,
			})

			// 构建最终提交的对象
			const fragmentConfig: FragmentConfig = {
				...restFragmentConfig,
				normal: {
					...processedConfig.normal,
					text_preprocess_rule: convertBooleanToPreprocessingRules(
						normalReplaceSpaces,
						normalRemoveUrls,
					),
				},
				parent_child: {
					...processedConfig.parent_child,
					text_preprocess_rule: convertBooleanToPreprocessingRules(
						parentChildReplaceSpaces,
						parentChildRemoveUrls,
					),
				},
			}

			return {
				...formValues,
				fragment_config: fragmentConfig,
			}
		} catch (error) {
			console.error("处理表单数据失败:", error)
			magicToast.error(t("knowledgeDatabase.saveConfigFailed"))
		}
	})

	return {
		form,
		segmentMode,
		parentBlockType,
		handleSegmentModeChange,
		handleParentBlockTypeChange,
		handleSegmentSettingReset: resetSegmentSettings,
		processFormData,
		initialValues: DEFAULT_FORM_VALUES,
	}
}
