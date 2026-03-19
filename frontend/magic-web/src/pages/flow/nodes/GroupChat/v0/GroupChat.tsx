import { Form, Flex, Switch } from "antd"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useTranslation } from "react-i18next"
import { ContactApi } from "@/apis"
import useInitialValue from "../../../common/hooks/useInitialValue"
import { customNodeType } from "../../../constants"
import MagicExpression from "../../../common/Expression"
import usePrevious from "../../../common/hooks/usePrevious"
import { groupTypeOptions } from "./constants"
import useStyles from "./style"
import useValueChange from "../../../common/hooks/useValueChange"

export default function GroupChatV0() {
	const { t } = useTranslation()
	const { styles } = useStyles()

	const { initialValues } = useInitialValue({ nodeType: customNodeType.GroupChat })

	const { expressionDataSource } = usePrevious()

	const searchMembers = useMemoizedFn(async (keyword: string) => {
		const members = await ContactApi.searchUser({
			query: keyword,
		})
		return members?.items?.map?.((member) => ({
			id: member.user_id,
			name: member.real_name || member.nickname,
			avatar: member.avatar_url,
		}))
	})

	const { onValuesChange } = useValueChange()

	return (
		<Form
			className={styles.groupChat}
			initialValues={initialValues}
			layout="vertical"
			onValuesChange={onValuesChange}
		>
			<DropdownCard title={t("groupChat.groupSettings", { ns: "flow" })}>
				<MagicExpression
					name="group_name"
					label={t("groupChat.groupName", { ns: "flow" })}
					mode={ExpressionMode.Common}
					placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
					dataSource={expressionDataSource}
					minHeight="auto"
					required
					showCustomLabel={false}
				/>

				<MagicExpression
					name="group_owner"
					label={t("groupChat.groupOwner", { ns: "flow" })}
					mode={ExpressionMode.Common}
					placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
					dataSource={expressionDataSource}
					minHeight="auto"
					required
					multiple={false}
					showCustomLabel={false}
					onlyExpression={false}
					renderConfig={{
						type: LabelTypeMap.LabelMember,
						props: {
							options: [],
							onChange: () => { },
							value: [],
							onSearch: async (params: { name: string }) => {
								const members = await searchMembers(params.name)
								return members
							},
						},
					}}
				/>

				<MagicExpression
					name="group_members"
					label={t("groupChat.groupMembers", { ns: "flow" })}
					mode={ExpressionMode.Common}
					placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
					dataSource={expressionDataSource}
					minHeight="auto"
					required={false}
					multiple
					showCustomLabel={false}
					onlyExpression={false}
					renderConfig={{
						type: LabelTypeMap.LabelMember,
						props: {
							options: [],
							onChange: () => { },
							value: [],
							onSearch: async (params: { name: string }) => {
								const members = await searchMembers(params.name)
								return members
							},
						},
					}}
				/>

				<Form.Item
					name="group_type"
					label={t("groupChat.groupType", { ns: "flow" })}
					required
					className={styles.formItem}
				>
					<MagicSelect options={groupTypeOptions} />
				</Form.Item>
			</DropdownCard>
			<Flex className={styles.switchSettings} align="center" gap={6}>
				<Flex>{t("groupChat.addCurrentUser", { ns: "flow" })}</Flex>
				<Form.Item name="include_current_user">
					<Switch size="small" />
				</Form.Item>
			</Flex>
			<Flex className={styles.switchSettings} align="center" gap={6}>
				<Flex>{t("groupChat.addCurrentAgent", { ns: "flow" })}</Flex>
				<Form.Item name="include_current_assistant">
					<Switch size="small" />
				</Form.Item>
			</Flex>
		</Form>
	)
}
