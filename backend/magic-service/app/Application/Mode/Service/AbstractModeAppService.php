<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ModelFilter\OrganizationBasedModelFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;

/**
 * Mode 应用层公共基类。
 *
 * 统一视频参数方案下，这里只保留少量与编排相关的公共能力：
 * - 获取当前组织可见的 provider 模型
 * - 整理视频 featured 求解所需的最小候选项
 *
 * 具体的视频能力定义与交集规则都应继续下沉到 domain service。
 */
abstract class AbstractModeAppService extends AbstractKernelAppService
{
    use HasLogger;

    public function __construct(
        protected ModeDomainService $modeDomainService,
        protected ProviderModelDomainService $providerModelDomainService,
        protected ModeGroupDomainService $groupDomainService,
        protected FileDomainService $fileDomainService,
        protected ProviderConfigDomainService $providerConfigDomainService,
        protected VideoGenerationConfigDomainService $videoGenerationConfigDomainService,
        protected ?OrganizationBasedModelFilterInterface $organizationModelFilter,
    ) {
    }

    /**
     * 处理分组DTO数组中的图标，将路径转换为完整的URL.
     *
     * @param ModeGroupDTO[] $groups
     */
    protected function processGroupIcons(array $groups): void
    {
        $iconPaths = [];
        foreach ($groups as $group) {
            $this->appendIconPath($iconPaths, $group->getIcon());
        }

        $iconUrls = $this->getIconUrls($iconPaths);
        if ($iconUrls === []) {
            return;
        }

        foreach ($groups as $group) {
            $this->replaceIcon($group->getIcon(), fn (string $iconUrl) => $group->setIcon($iconUrl), $iconUrls);
        }
    }

    /**
     * 处理模式聚合根中的图标，将路径转换为完整的URL.
     */
    protected function processModeAggregateIcons(AdminModeAggregateDTO|ModeAggregate|ModeAggregateDTO $modeAggregateDTO): void
    {
        $iconPaths = [];
        foreach ($modeAggregateDTO->getGroups() as $groupAggregate) {
            $this->appendIconPath($iconPaths, $groupAggregate->getGroup()->getIcon());
            $this->collectModelIconPaths($groupAggregate->getModels(), $iconPaths);
            $this->collectModelIconPaths($groupAggregate->getImageModels(), $iconPaths);
            $this->collectModelIconPaths($groupAggregate->getVideoModels(), $iconPaths);
        }

        $iconUrls = $this->getIconUrls($iconPaths);
        if ($iconUrls === []) {
            return;
        }

        foreach ($modeAggregateDTO->getGroups() as $groupAggregate) {
            $group = $groupAggregate->getGroup();
            $this->replaceIcon($group->getIcon(), fn (string $iconUrl) => $group->setIcon($iconUrl), $iconUrls);
            $this->replaceModelIcons($groupAggregate->getModels(), $iconUrls);
            $this->replaceModelIcons($groupAggregate->getImageModels(), $iconUrls);
            $this->replaceModelIcons($groupAggregate->getVideoModels(), $iconUrls);
        }
    }

    /**
     * 获取数据隔离对象
     */
    protected function getModeDataIsolation(MagicUserAuthorization $authorization): ModeDataIsolation
    {
        return $this->createModeDataIsolation($authorization);
    }

    /**
     * 更新 Agent 图标 URL.
     *
     * @param SuperMagicAgentEntity[] $agentEntities
     * @return SuperMagicAgentEntity[]
     */
    protected function updateAgentEntitiesIcon(array $agentEntities): array
    {
        $codeMapUrls = $this->collectAgentIconPathsByOrganization($agentEntities);
        $agentsByOrganization = $this->indexAgentEntitiesByOrganization($agentEntities);

        foreach ($codeMapUrls as $organizationCode => $codeMapUrl) {
            $fileUrlsMap = $this->getIcons($organizationCode, $codeMapUrl);
            $this->applyAgentIconUrls($agentsByOrganization[$organizationCode] ?? [], $codeMapUrl, $fileUrlsMap);
        }

        return $agentEntities;
    }

    /**
     * 获取模型（考虑服务商级联状态）.
     * @return ProviderModelEntity[]
     */
    protected function getModels(ModeAggregate $modeAggregate): array
    {
        [, $allModels, $providerStatuses] = $this->loadModeModels($modeAggregate);
        if ($allModels === []) {
            return [];
        }

        return $this->filterAvailableModels($allModels, $providerStatuses);
    }

    /**
     * 获取详细的模型信息（用于管理后台，考虑服务商级联状态）.
     * @return array<string, array{best: null|ProviderModelEntity, all: ProviderModelEntity[], status: ModelStatus}>
     */
    protected function getDetailedModels(ModeAggregate $modeAggregate): array
    {
        [$allModelIds, $allModels, $providerStatuses] = $this->loadModeModels($modeAggregate);
        if ($allModelIds === []) {
            return [];
        }

        $result = [];
        foreach ($allModelIds as $modelId) {
            $models = $allModels[$modelId] ?? [];
            $bestModel = $this->selectBestModel($models, $providerStatuses);
            $status = $this->determineStatus($models, $providerStatuses);

            $result[$modelId] = [
                'best' => $bestModel,
                'all' => $models,
                'status' => $status,
            ];
        }

        return $result;
    }

    /**
     * 批量获取服务商状态.
     *
     * @param array<string, ProviderModelEntity[]> $allModels
     * @return array<int, Status>
     */
    protected function getProviderStatuses(ProviderDataIsolation $providerDataIsolation, array $allModels): array
    {
        $providerConfigIds = [];
        foreach ($allModels as $models) {
            foreach ($models as $model) {
                $providerConfigIds[] = $model->getServiceProviderConfigId();
            }
        }

        if (empty($providerConfigIds)) {
            return [];
        }

        $providerStatuses = [];
        $providerConfigs = $this->providerConfigDomainService->getByIds($providerDataIsolation, array_unique($providerConfigIds));
        foreach ($providerConfigs as $config) {
            $providerStatuses[$config->getId()] = $config->getStatus();
        }

        return $providerStatuses;
    }

    /**
     * 为每个 model_id 选择可用模型（考虑服务商级联状态）.
     *
     * @param array<string, ProviderModelEntity[]> $allModels
     * @param array<int, Status> $providerStatuses
     * @return array<string, ProviderModelEntity>
     */
    protected function filterAvailableModels(array $allModels, array $providerStatuses): array
    {
        $providerModels = [];
        foreach ($allModels as $modelId => $models) {
            $bestModel = $this->selectBestModel($models, $providerStatuses);
            if (! $bestModel instanceof ProviderModelEntity) {
                continue;
            }

            if (
                $bestModel->isDynamicModel()
                && ! $this->isDynamicModelEffectivelyAvailable($bestModel, $allModels, $providerStatuses)
            ) {
                continue;
            }

            $providerModels[$modelId] = $bestModel;
        }

        return $providerModels;
    }

    /**
     * @param array<string> $allModelIds
     * @return array<string, list<ProviderModelEntity>>
     */
    protected function getModelGroupsBatch(array $allModelIds): array
    {
        if (empty($allModelIds)) {
            return [];
        }

        // 这里返回的是“同一个逻辑 model_id 下，所有当前仍可用的 provider 模型”。
        // 相比 selectBestModel 只选一条，这里保留整组数据，是为了后续做视频能力交集。
        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, $allModelIds);
        $allModels = $this->expandModelGroupsForDynamicSubModels($providerDataIsolation, $allModels);
        $providerStatuses = $this->getProviderStatuses($providerDataIsolation, $allModels);

        return $this->filterAvailableModelGroups($allModels, $providerStatuses);
    }

    /**
     * @param list<string> $modelIds
     * @return list<VideoGenerationConfigCandidate>
     */
    protected function buildVideoGenerationConfigCandidates(array $modelIds): array
    {
        if ($modelIds === []) {
            return [];
        }

        // app 层先完成“当前组织可见且可用 provider 模型”的整理，
        // 再收缩成求交集所需的最小候选信息，交给 domain 做能力解析。
        $groupedModels = $this->getModelGroupsBatch(array_values(array_unique($modelIds)));
        if ($groupedModels === []) {
            return [];
        }

        $providerCodesByConfigId = $this->getProviderCodesByConfigIds($groupedModels);
        $candidates = [];
        foreach ($groupedModels as $modelId => $providerModels) {
            foreach ($providerModels as $providerModel) {
                // ProviderModelEntity 持有的是 service_provider_config_id，
                // 这里补齐成 domain 解析能力所需的 providerCode。
                $providerCode = $providerCodesByConfigId[$providerModel->getServiceProviderConfigId()] ?? null;
                if (! $providerCode instanceof ProviderCode) {
                    continue;
                }

                $candidates[] = new VideoGenerationConfigCandidate(
                    modelId: $modelId,
                    modelVersion: $providerModel->getModelVersion(),
                    providerCode: $providerCode,
                );
            }
        }

        return $candidates;
    }

    /**
     * 从模型列表中选择最佳模型（考虑服务商级联状态）.
     *
     * @param ProviderModelEntity[] $models 模型列表
     * @param array<int, Status> $providerStatuses 服务商状态映射
     * @return null|ProviderModelEntity 选择的最佳模型，如果没有可用模型则返回null
     */
    protected function selectBestModel(array $models, array $providerStatuses = []): ?ProviderModelEntity
    {
        if ($models === []) {
            return null;
        }

        if ($providerStatuses === []) {
            // LLM / 图像等历史逻辑仍然只选一个最佳模型，
            // 视频多 provider 交集场景则走 getModelGroupsBatch 保留整组数据。
            return array_find($models, fn (ProviderModelEntity $model) => $this->isModelEnabled($model));
        }

        return array_find($models, fn (ProviderModelEntity $model) => $this->isProviderModelAvailable($model, $providerStatuses));
    }

    /**
     * @param array<string, list<ProviderModelEntity>> $groupedModels
     * @return array<int, ProviderCode>
     */
    protected function getProviderCodesByConfigIds(array $groupedModels): array
    {
        // featured 求交集只关心 providerCode，因此这里把 configId 映射成 providerCode。
        $configIds = [];
        foreach ($groupedModels as $providerModels) {
            foreach ($providerModels as $providerModel) {
                $configIds[] = $providerModel->getServiceProviderConfigId();
            }
        }

        if ($configIds === []) {
            return [];
        }

        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $providerConfigs = $this->providerConfigDomainService->getByIds($providerDataIsolation, array_values(array_unique($configIds)));

        $providerCodes = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerCode = $providerConfig->getProviderCode();
            if (! $providerCode instanceof ProviderCode) {
                continue;
            }
            $providerCodes[(int) $providerConfig->getId()] = $providerCode;
        }

        return $providerCodes;
    }

    /**
     * @param array<string, list<ProviderModelEntity>> $allModels
     * @param array<int, Status> $providerStatuses
     * @return array<string, list<ProviderModelEntity>>
     */
    protected function filterAvailableModelGroups(array $allModels, array $providerStatuses): array
    {
        // 与 filterAvailableModels 的区别在于：
        // 这里不做“最佳模型选择”，而是保留每个逻辑 model_id 的全部可用 provider。
        $availableModelGroups = [];
        foreach ($allModels as $modelId => $providerModels) {
            $availableProviderModels = [];
            foreach ($providerModels as $providerModel) {
                if (
                    $providerModel->isDynamicModel()
                    && ! $this->isDynamicModelEffectivelyAvailable($providerModel, $allModels, $providerStatuses)
                ) {
                    continue;
                }

                if (! $this->isProviderModelAvailable($providerModel, $providerStatuses)) {
                    continue;
                }
                $availableProviderModels[] = $providerModel;
            }

            if ($availableProviderModels !== []) {
                $availableModelGroups[$modelId] = $availableProviderModels;
            }
        }

        return $availableModelGroups;
    }

    /**
     * @param array<int, Status> $providerStatuses
     */
    protected function isProviderModelAvailable(ProviderModelEntity $providerModel, array $providerStatuses): bool
    {
        // 视频 featured 能力求交集的前提，是 provider 模型此刻真的可用。
        if (! $this->isModelEnabled($providerModel)) {
            return false;
        }

        if ($providerModel->isDynamicModel()) {
            return true;
        }

        $providerStatus = $providerStatuses[$providerModel->getServiceProviderConfigId()] ?? Status::Disabled;

        return $providerStatus === Status::Enabled;
    }

    /**
     * @param array<string, list<ProviderModelEntity>> $allModels
     * @return array<string, list<ProviderModelEntity>>
     */
    protected function expandModelGroupsForDynamicSubModels(
        ProviderDataIsolation $providerDataIsolation,
        array $allModels
    ): array {
        $expandedModels = $allModels;
        $scannedModelIds = [];
        $pendingModelIds = array_keys($expandedModels);

        while ($pendingModelIds !== []) {
            $missingSubModelIds = [];
            $nextPendingModelIds = [];

            foreach ($pendingModelIds as $modelId) {
                if (isset($scannedModelIds[$modelId])) {
                    continue;
                }
                $scannedModelIds[$modelId] = true;

                foreach ($expandedModels[$modelId] ?? [] as $providerModel) {
                    if (! $providerModel->isDynamicModel()) {
                        continue;
                    }

                    foreach ($this->extractDynamicSubModelIds($providerModel) as $subModelId) {
                        if (isset($expandedModels[$subModelId])) {
                            if (! isset($scannedModelIds[$subModelId])) {
                                $nextPendingModelIds[$subModelId] = $subModelId;
                            }
                            continue;
                        }

                        $missingSubModelIds[$subModelId] = $subModelId;
                    }
                }
            }

            if ($missingSubModelIds !== []) {
                $fetchedModels = $this->providerModelDomainService->getModelsByModelIds(
                    $providerDataIsolation,
                    array_values($missingSubModelIds)
                );

                foreach ($fetchedModels as $subModelId => $providerModels) {
                    $expandedModels[$subModelId] = $providerModels;
                    $nextPendingModelIds[$subModelId] = $subModelId;
                }
            }

            $pendingModelIds = array_values($nextPendingModelIds);
        }

        return $expandedModels;
    }

    /**
     * 根据模型列表确定状态（考虑服务商级联状态）.
     *
     * @param ProviderModelEntity[] $models 模型列表
     * @param array<int, Status> $providerStatuses 服务商状态映射
     * @return ModelStatus 状态：Normal、Disabled、Deleted
     */
    private function determineStatus(array $models, array $providerStatuses = []): ModelStatus
    {
        if ($models === []) {
            return ModelStatus::Deleted;
        }

        if ($providerStatuses === []) {
            return array_any($models, fn (ProviderModelEntity $model) => $this->isModelEnabled($model))
                ? ModelStatus::Normal
                : ModelStatus::Disabled;
        }

        return array_any($models, fn (ProviderModelEntity $model) => $this->isProviderModelAvailable($model, $providerStatuses))
            ? ModelStatus::Normal
            : ModelStatus::Disabled;
    }

    /**
     * @param list<string> $iconPaths
     */
    private function appendIconPath(array &$iconPaths, ?string $iconPath): void
    {
        if ($iconPath === null || $iconPath === '' || is_url($iconPath)) {
            return;
        }

        $iconPaths[] = $iconPath;
    }

    /**
     * @param list<ModeGroupModelDTO> $models
     * @param list<string> $iconPaths
     */
    private function collectModelIconPaths(array $models, array &$iconPaths): void
    {
        foreach ($models as $model) {
            $this->appendIconPath($iconPaths, $model->getModelIcon());
        }
    }

    /**
     * @param list<string> $iconPaths
     * @return array<string, FileLink>
     */
    private function getIconUrls(array $iconPaths): array
    {
        $uniqueIconPaths = array_values(array_unique($iconPaths));
        if ($uniqueIconPaths === []) {
            return [];
        }

        return $this->fileDomainService->getBatchLinksByOrgPaths($uniqueIconPaths);
    }

    /**
     * @param array<string, FileLink> $iconUrls
     */
    private function replaceIcon(?string $iconPath, callable $setter, array $iconUrls): void
    {
        if ($iconPath === null || $iconPath === '' || ! isset($iconUrls[$iconPath]) || is_url($iconPath)) {
            return;
        }

        $setter($iconUrls[$iconPath]->getUrl());
    }

    /**
     * @param list<ModeGroupModelDTO> $models
     * @param array<string, FileLink> $iconUrls
     */
    private function replaceModelIcons(array $models, array $iconUrls): void
    {
        foreach ($models as $model) {
            $this->replaceIcon($model->getModelIcon(), fn (string $iconUrl) => $model->setModelIcon($iconUrl), $iconUrls);
        }
    }

    private function resolveAgentIconPath(SuperMagicAgentEntity $agent): ?string
    {
        $icon = $agent->getIcon();

        return EasyFileTools::formatPath($icon['url'] ?? '')
            ?: EasyFileTools::formatPath($icon['value'] ?? '')
            ?: null;
    }

    /**
     * @param SuperMagicAgentEntity[] $agentEntities
     * @return array<string, array<string, string>>
     */
    private function collectAgentIconPathsByOrganization(array $agentEntities): array
    {
        $codeMapUrls = [];
        foreach ($agentEntities as $agent) {
            $formattedPath = $this->resolveAgentIconPath($agent);
            if ($formattedPath === null) {
                continue;
            }

            $codeMapUrls[$agent->getOrganizationCode()][$agent->getCode()] = $formattedPath;
        }

        return $codeMapUrls;
    }

    /**
     * @param SuperMagicAgentEntity[] $agentEntities
     * @return array<string, array<string, SuperMagicAgentEntity>>
     */
    private function indexAgentEntitiesByOrganization(array $agentEntities): array
    {
        $agentsByOrganization = [];
        foreach ($agentEntities as $agent) {
            $agentsByOrganization[$agent->getOrganizationCode()][$agent->getCode()] = $agent;
        }

        return $agentsByOrganization;
    }

    /**
     * @param array<string, SuperMagicAgentEntity> $agentsByCode
     * @param array<string, string> $iconPathsByCode
     * @param array<string, FileLink> $fileUrlsMap
     */
    private function applyAgentIconUrls(array $agentsByCode, array $iconPathsByCode, array $fileUrlsMap): void
    {
        foreach ($iconPathsByCode as $agentCode => $iconPath) {
            $agentEntity = $agentsByCode[$agentCode] ?? null;
            $fileLink = $fileUrlsMap[$iconPath] ?? null;
            if (! $agentEntity instanceof SuperMagicAgentEntity || ! $fileLink instanceof FileLink) {
                continue;
            }

            $this->replaceAgentIcon($agentEntity, $fileLink);
        }
    }

    private function replaceAgentIcon(SuperMagicAgentEntity $agentEntity, FileLink $fileLink): void
    {
        $icon = $agentEntity->getIcon();
        $iconUrl = $fileLink->getUrl();
        $icon['url'] = $iconUrl;
        $icon['value'] = $iconUrl;
        $agentEntity->setIcon($icon);
    }

    /**
     * @return list<string>
     */
    private function getUniqueModelIds(ModeAggregate $modeAggregate): array
    {
        $allModelIds = [];
        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $allModelIds[] = $relation->getModelId();
            }
        }

        return array_values(array_unique($allModelIds));
    }

    /**
     * @return array{0: list<string>, 1: array<string, ProviderModelEntity[]>, 2: array<int, Status>}
     */
    private function loadModeModels(ModeAggregate $modeAggregate): array
    {
        $modelIds = $this->getUniqueModelIds($modeAggregate);
        if ($modelIds === []) {
            return [[], [], []];
        }

        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, $modelIds);
        $allModels = $this->expandModelGroupsForDynamicSubModels($providerDataIsolation, $allModels);

        return [$modelIds, $allModels, $this->getProviderStatuses($providerDataIsolation, $allModels)];
    }

    private function isModelEnabled(ProviderModelEntity $model): bool
    {
        return $model->getStatus() === Status::Enabled;
    }

    /**
     * @param array<string, list<ProviderModelEntity>> $allModels
     * @param array<int, Status> $providerStatuses
     */
    private function isDynamicModelEffectivelyAvailable(
        ProviderModelEntity $dynamicModel,
        array $allModels,
        array $providerStatuses,
        array &$visitedModelIds = []
    ): bool {
        $modelId = $dynamicModel->getModelId();
        if ($modelId === '' || isset($visitedModelIds[$modelId])) {
            return false;
        }
        $visitedModelIds[$modelId] = true;

        foreach ($this->extractDynamicSubModelIds($dynamicModel) as $subModelId) {
            $subProviderModels = $allModels[$subModelId] ?? [];
            foreach ($subProviderModels as $subProviderModel) {
                if ($subProviderModel->isDynamicModel()) {
                    if ($this->isDynamicModelEffectivelyAvailable($subProviderModel, $allModels, $providerStatuses, $visitedModelIds)) {
                        return true;
                    }
                    continue;
                }

                if ($this->isProviderModelAvailable($subProviderModel, $providerStatuses)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function extractDynamicSubModelIds(ProviderModelEntity $dynamicModel): array
    {
        $aggregateConfig = $dynamicModel->getAggregateConfig() ?? [];
        $subModels = $aggregateConfig['models'] ?? [];
        $subModelIds = [];

        foreach ($subModels as $subModel) {
            if (is_string($subModel) && $subModel !== '') {
                $subModelIds[$subModel] = $subModel;
                continue;
            }

            if (is_array($subModel) && ($subModel['model_id'] ?? '') !== '') {
                $subModelId = (string) $subModel['model_id'];
                $subModelIds[$subModelId] = $subModelId;
            }
        }

        return array_values($subModelIds);
    }
}
