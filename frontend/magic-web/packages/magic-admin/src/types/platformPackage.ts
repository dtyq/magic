import * as Common from "./platformPackage/common"
import * as PackageTypes from "./platformPackage/package"
import * as ModeTypes from "./platformPackage/mode"
import * as MarketTypes from "./platformPackage/market"
import * as AiPowerTypes from "./platformPackage/aiPower"

/** 平台套餐 */
export namespace PlatformPackage {
	export type GlobalConfig = Common.GlobalConfig
	export type NameI18N = Common.NameI18N
	export import PackageType = Common.PackageType
	export import SubscriptionType = Common.SubscriptionType

	export type Package = PackageTypes.Package
	export type Skus = PackageTypes.Skus

	export type ModeListParams = ModeTypes.ModeListParams
	export import DistributionType = ModeTypes.DistributionType
	export import IconType = ModeTypes.IconType
	export type Mode = ModeTypes.Mode
	export type AddModeParams = ModeTypes.AddModeParams
	export type ModeGroup = ModeTypes.ModeGroup
	export type AddModeGroupParams = ModeTypes.AddModeGroupParams
	export import ModeGroupModelStatus = ModeTypes.ModeGroupModelStatus
	export type BaseModel = ModeTypes.BaseModel
	export import ModelType = ModeTypes.ModelType
	export import StrategyType = ModeTypes.StrategyType
	export import OrderDirection = ModeTypes.OrderDirection
	export type DynamicModel = ModeTypes.DynamicModel
	export type ModelItem = ModeTypes.ModelItem
	export type ModeDetail = ModeTypes.ModeDetail
	export type GetAllModelListParams = ModeTypes.GetAllModelListParams

	export type GetSkillVersionListParams = MarketTypes.GetSkillVersionListParams
	export type SkillVersion = MarketTypes.SkillVersion
	export type ReviewSkillAction = MarketTypes.ReviewSkillAction
	export type SkillPublisherType = MarketTypes.SkillPublisherType
	export type ReviewSkillVersionParams = MarketTypes.ReviewSkillVersionParams
	export type GetSkillMarketListParams = MarketTypes.GetSkillMarketListParams
	export type SkillMarketItem = MarketTypes.SkillMarketItem
	export type UpdateSkillMarketInfoParams = MarketTypes.UpdateSkillMarketInfoParams
	export type GetAgentMarketListParams = MarketTypes.GetAgentMarketListParams
	export type RoleI18N = MarketTypes.RoleI18N
	export type AgentMarketItem = MarketTypes.AgentMarketItem
	export type UpdateAgentMarketInfoParams = MarketTypes.UpdateAgentMarketInfoParams
	export type GetAgentVersionReviewListParams = MarketTypes.GetAgentVersionReviewListParams
	export type AgentVersionReview = MarketTypes.AgentVersionReview

	export type GetAiPowerListParams = AiPowerTypes.GetAiPowerListParams
	export import PowerCode = AiPowerTypes.PowerCode
	export type TestAiPowerConnection = AiPowerTypes.TestAiPowerConnection
	export type AiPower = AiPowerTypes.AiPower
	export type ProviderConfig = AiPowerTypes.ProviderConfig
	export type AiPowerConfig = AiPowerTypes.AiPowerConfig
	export type AiPowerDetail = AiPowerTypes.AiPowerDetail
	export type UpdateAiPowerParams = AiPowerTypes.UpdateAiPowerParams
}
