import { useMemo, useState } from "react"
import type { HTTP } from "@/types/flow"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import type { EventEmitter } from "ahooks/lib/useEventEmitter"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import { findBracedStrings } from "../helpers"

enum UpdateType {
	Url = "url",
	Methods = "methods",
}

interface PostAddrSettingsProps {
	value: {
		domain: HTTP.Api["structure"]["domain"]
		method: HTTP.Api["structure"]["method"]
		url: HTTP.Api["structure"]["url"]
	}
	paths: {
		url: string[]
		domain: string[]
		method: string[]
	}
	onChange: (path: string[], value: any) => void
	pathEventEmitter: EventEmitter<string[]>
}

function PostAddrSettings({ value, onChange, paths, pathEventEmitter }: PostAddrSettingsProps) {
	const { t } = useTranslation()

	const updateFunc = useMemoizedFn((changePath: string[], val: any, type: UpdateType) => {
		if (type === UpdateType.Url && val.length > 0) {
			const addrString = val
			const pathFieldNames = findBracedStrings(addrString)
			// console.log("pathFieldNames: ", pathFieldNames)
			// 通知path组件更新
			pathEventEmitter.emit(pathFieldNames)
		}
		onChange(changePath, val)
	})

	const SelectBefore = useMemo(
		() => (
			<MagicSelect
				value={value.method}
				className={styles.methodSelect}
				style={{ width: 120 }}
				onChange={(val: string) => updateFunc(paths.method, val, UpdateType.Methods)}
				placeholder={t("http.requestMethod", { ns: "flow" })}
				options={[
					{ value: "get", label: "GET" },
					{ value: "post", label: "POST" },
					{ value: "put", label: "PUT" },
					{ value: "delete", label: "DELETE" },
					{ value: "patch", label: "PATCH" },
				]}
			/>
		),
		[paths.method, t, updateFunc, value.method],
	)

	const [url, setUrl] = useState(value?.url)

	useUpdateEffect(() => {
		setUrl(value?.url)
	}, [value?.url])

	const onURLUpdate = useMemoizedFn((e: any) => {
		setUrl(e.target.value)
		updateFunc(paths.url, e.target.value, UpdateType.Url)
	})

	return (
		<div className={styles.addr}>
			<p className={styles.stepTitle}>{t("http.request", { ns: "flow" })}</p>
			<div className={styles.addressWrapper}>
				{SelectBefore}
				{/* <Input
					style={{ width: 200, marginLeft: "6px" }}
					defaultValue={value.domain}
					placeholder="请输入域名"
				/> */}
				<div style={{ flex: 1, marginLeft: "4px" }}>
					<MagicInput
						value={url}
						onChange={onURLUpdate}
						placeholder={t("http.requestUrlPlaceholder", { ns: "flow" })}
					/>
					{/* <InputExpression
						value={value.uri}
						onChange={(keys, val) => updateFunc(paths.uri, val)}
						allowExpression={false}
					/> */}
				</div>
			</div>
		</div>
	)
}

export default PostAddrSettings
