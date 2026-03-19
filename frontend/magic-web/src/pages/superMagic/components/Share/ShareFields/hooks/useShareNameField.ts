import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { calculateDefaultShareName } from "../../utils"

interface UseShareNameFieldOptions {
	value: string
	onChange: (value: string) => void
	defaultOpenFileId?: string
	selectedFiles: Array<{ name?: string; fileName?: string }>
	attachments: Array<{ name?: string; fileName?: string }>
	shareProject: boolean
	projectName?: string
}

interface UseShareNameFieldReturn {
	// 计算值
	defaultValue: string
	fileSharePrefix: string

	// 验证状态
	error: string
	showError: boolean

	// 事件处理器
	handleBlur: () => void
	handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function useShareNameField(options: UseShareNameFieldOptions): UseShareNameFieldReturn {
	const {
		value,
		onChange,
		defaultOpenFileId,
		selectedFiles,
		attachments,
		shareProject,
		projectName,
	} = options

	const { t } = useTranslation("super")
	const [error, setError] = useState<string>("")
	const [touched, setTouched] = useState(false)
	const isInitializedRef = useRef(false)

	// 性能优化: 缓存文件分享前缀
	const fileSharePrefix = useMemo(
		() => t("share.singleFileShareName", { fileName: "" }).split("_")[0],
		[t],
	)

	// 性能优化: 缓存 selectedFiles 的稳定标识
	const selectedFilesKey = useMemo(() => {
		if (!selectedFiles || selectedFiles.length === 0) return ""
		return selectedFiles
			.map((f) => (f as Record<string, unknown>).file_id || (f as Record<string, unknown>).id)
			.sort()
			.join(",")
	}, [selectedFiles])

	// 计算默认值
	const defaultValue = useMemo(() => {
		return calculateDefaultShareName(
			defaultOpenFileId,
			selectedFiles,
			attachments,
			t,
			shareProject,
			projectName,
		)
	}, [defaultOpenFileId, selectedFiles, attachments, t, shareProject, projectName])

	// 初始化默认值
	useEffect(() => {
		// 新建场景：如果 value 为空且有默认值，则使用默认值初始化
		if (!value && defaultValue && defaultValue !== "") {
			onChange(defaultValue)
			// 成功设置默认值后才标记为已初始化
			if (!isInitializedRef.current) {
				isInitializedRef.current = true
			}
		}
		// 编辑场景：如果 value 已经有值，立即标记为已初始化（允许后续动态更新）
		else if (!isInitializedRef.current && value) {
			isInitializedRef.current = true
		}
	}, [value, defaultValue, onChange])

	// 防抖更新名称
	const { run: updateNameDebounced } = useDebounceFn(
		() => {
			if (!value || !selectedFiles || selectedFiles.length === 0) return

			if (!shareProject && value.startsWith(fileSharePrefix + "_")) {
				const newDefaultValue = calculateDefaultShareName(
					defaultOpenFileId,
					selectedFiles,
					attachments,
					t,
					shareProject,
					projectName,
				)
				if (newDefaultValue && newDefaultValue !== value) {
					onChange(newDefaultValue)
				}
			}
		},
		{ wait: 200 },
	)

	// 监听文件变化，动态更新名称
	useEffect(() => {
		if (isInitializedRef.current && selectedFilesKey) {
			updateNameDebounced()
		}
	}, [selectedFilesKey, defaultOpenFileId, shareProject, updateNameDebounced])

	// 失焦验证
	const handleBlur = useCallback(() => {
		setTouched(true)
		if (!value || value.trim() === "") {
			setError(t("share.shareNameRequired"))
		} else {
			setError("")
		}
	}, [value, t])

	// 输入变化处理
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			onChange(newValue)
			if (touched && error && newValue.trim() !== "") {
				setError("")
			}
		},
		[onChange, touched, error],
	)

	return {
		defaultValue,
		fileSharePrefix,
		error,
		showError: touched && !!error,
		handleBlur,
		handleChange,
	}
}
