import KeyManagerButton from "@/pages/flow/components/KeyManager/KeyManagerButton"
import { Button, Flex } from "antd"
import { useBoolean } from "ahooks"
import { useMemo } from "react"
import type { Bot } from "@/types/bot"
import styles from "../components/SaveDraftButton/index.module.less"

type UseApiKeyProps = {
	agent: Bot.Detail
}

/**
 * ApiKey 管理组件及其相关状态
 */
export default function useApiKey({ agent }: UseApiKeyProps) {
	const [keyManagerOpen, { setTrue: openKeyManager, setFalse: closeKeyManager }] =
		useBoolean(false)

	const ApiKeyButton = useMemo(() => {
		return (
			<Flex align="center" justify="center">
				<Button
					type="text"
					onClick={(e) => {
						e.stopPropagation()
						openKeyManager()
					}}
					className={styles.btn}
				>
					API Key
				</Button>
				<KeyManagerButton
					open={keyManagerOpen}
					onClose={closeKeyManager}
					flowId={agent?.botEntity?.flow_code || ""}
					isAgent
				/>
			</Flex>
		)
	}, [agent?.botEntity?.flow_code, closeKeyManager, keyManagerOpen, openKeyManager])

	return {
		ApiKeyButton,
	}
}
