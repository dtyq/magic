import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { memo, useMemo } from "react"
import type { PlatformPackage } from "@/types/platformPackage"
import InputNumber from "../InputNumber"
import CloudStroageInput from "../CloudStroageInput"
import InputNumberMax from "../LimitInput"
import { useGetStyles } from "../../index.page"

const SuperMagicGroup = memo(
	({ packageOptions }: { packageOptions?: PlatformPackage.PackageConstantOptions }) => {
		const { t } = useTranslation("admin/platform/manage")
		const styles = useGetStyles()

		const options = useMemo(() => {
			return packageOptions?.feature_limit_types || []
		}, [packageOptions])

		return (
			<Flex vertical className={styles.packageInfo} gap={20}>
				<InputNumberMax
					name1={["skus", "attributes", "feature_limits", "workspace_limit_type"]}
					name={["skus", "attributes", "feature_limits", "workspace_limit"]}
					label={t("workspaceLimit")}
					addonAfter={t("piece")}
					description={t("workspaceLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={["skus", "attributes", "feature_limits", "topic_limit_type"]}
					name={["skus", "attributes", "feature_limits", "topic_limit"]}
					label={t("topicLimit")}
					addonAfter={t("piece")}
					description={t("topicLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={["skus", "attributes", "feature_limits", "topic_share_limit_type"]}
					name={["skus", "attributes", "feature_limits", "topic_share_limit"]}
					label={t("topicShareLimit")}
					addonAfter={t("piece")}
					description={t("topicShareLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={[
						"skus",
						"attributes",
						"feature_limits",
						"website_generation_limit_type",
					]}
					name={["skus", "attributes", "feature_limits", "website_generation_limit"]}
					label={t("generateWebLimit")}
					addonAfter={t("piece")}
					description={t("generateWebLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={["skus", "attributes", "feature_limits", "concurrent_task_limit_type"]}
					name={["skus", "attributes", "feature_limits", "concurrent_task_limit"]}
					label={t("singleUserMuTaskConcurrencyLimit")}
					addonAfter={t("piece")}
					description={t("singleUserMuTaskConcurrencyLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={[
						"skus",
						"attributes",
						"feature_limits",
						"high_priority_execution_times_type",
					]}
					name={["skus", "attributes", "feature_limits", "high_priority_execution_times"]}
					label={t("singleUserMaxExecutionRounds")}
					addonAfter={t("times")}
					description={t("singleUserMaxExecutionRoundsDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={[
						"skus",
						"attributes",
						"feature_limits",
						"single_round_consumption_limit_type",
					]}
					name={[
						"skus",
						"attributes",
						"feature_limits",
						"single_round_consumption_limit",
					]}
					label={t("singleTaskSingleRoundConsumptionLimit")}
					addonAfter={t("point")}
					description={t("singleTaskSingleRoundConsumptionLimitDesc")}
					options={options}
				/>
				<InputNumberMax
					name1={[
						"skus",
						"attributes",
						"feature_limits",
						"superMagic_project_copy_limit_type",
					]}
					name={["skus", "attributes", "feature_limits", "superMagic_project_copy_limit"]}
					label={t("superMagicCopyLimit")}
					addonAfter={t("piece")}
					description={t("superMagicCopyLimitDesc")}
					options={options}
				/>

				<InputNumber
					name={["skus", "attributes", "peak_priority_level"]}
					label={t("priority")}
				/>

				<CloudStroageInput
					name={["skus", "attributes", "cloud_storage_capacity"]}
					label={t("cloudDiskCapacity")}
				/>
			</Flex>
		)
	},
)

export default SuperMagicGroup
