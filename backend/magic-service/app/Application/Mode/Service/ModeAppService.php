<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\Old\SuperMagicAgentOldAppService;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;

class ModeAppService extends AbstractModeAppService
{
    /**
     * 废弃.
     * @deprecated
     */
    public function getModes(MagicUserAuthorization $authorization): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        // 获取目前的所有可用的 agent
        $superMagicAgentAppService = di(SuperMagicAgentOldAppService::class);
        $agentData = $superMagicAgentAppService->queries($authorization, new SuperMagicAgentQuery(), Page::createNoPage());
        // 合并常用和全部 agent 列表，常用在前
        /** @var array<SuperMagicAgentEntity> $allAgents */
        $allAgents = array_merge($agentData['frequent'], $agentData['all']);
        if (empty($allAgents)) {
            return [];
        }
        $agentIcons = [];
        foreach ($allAgents as $agent) {
            // 这里是一个完整的 url，我们需要只提取 path
            $agentIconData = $agent->getIcon();
            $agentIcon = EasyFileTools::formatPath($agent->getIcon()['url'] ?? '');
            $agentIconData['url'] = $agentIcon;
            if ($agentIcon) {
                $agentIcons[] = $agentIcon;
            }
            $agent->setIcon($agentIconData);
        }
        $agentIconUrls = $this->getIconsWithSmartOrganization($agentIcons);

        // 获取后台的所有模式，用于封装数据到 Agent 中
        $query = new ModeQuery(status: true);
        $modeEnabledList = $this->modeDomainService->getModes($modeDataIsolation, $query, Page::createNoPage())['list'];

        // 批量构建模式聚合根
        $modeAggregates = $this->modeDomainService->batchBuildModeAggregates($modeDataIsolation, $modeEnabledList);

        // ===== 性能优化：批量预查询 =====

        // 步骤1：预收集所有需要的modelId
        $allModelIds = [];
        foreach ($modeAggregates as $aggregate) {
            foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
                foreach ($groupAggregate->getRelations() as $relation) {
                    $allModelIds[] = $relation->getModelId();
                }
            }
        }

        // 步骤2：批量查询所有模型和服务商状态
        $allProviderModelsWithStatus = $this->getModelsBatch(array_unique($allModelIds));

        // 步骤3：组织模型过滤

        // 首先收集所有需要过滤的模型（LLM）
        $allAggregateModels = [];
        foreach ($modeAggregates as $aggregate) {
            $aggregateModels = $this->getModelsForAggregate($aggregate, $allProviderModelsWithStatus);
            $allAggregateModels = array_merge($allAggregateModels, $aggregateModels);
        }

        // 收集所有需要过滤的图像模型（VLM）
        $allAggregateImageModels = [];
        foreach ($modeAggregates as $aggregate) {
            $aggregateImageModels = $this->getImageModelsForAggregate($aggregate, $allProviderModelsWithStatus);
            $allAggregateImageModels = array_merge($allAggregateImageModels, $aggregateImageModels);
        }

        // 需要升级套餐
        $upgradeRequiredModelIds = [];

        // 使用组织过滤器进行过滤（LLM）
        if ($this->organizationModelFilter) {
            $providerModels = $this->organizationModelFilter->filterModelsByOrganization(
                $authorization->getOrganizationCode(),
                $allAggregateModels
            );
            $upgradeRequiredModelIds = $this->organizationModelFilter->getUpgradeRequiredModelIds($authorization->getOrganizationCode());
        } else {
            // 如果没有组织过滤器，返回所有模型（开源版本行为）
            $providerModels = $allAggregateModels;
        }

        // 使用组织过滤器进行过滤（VLM）
        if ($this->organizationModelFilter) {
            $providerImageModels = $this->organizationModelFilter->filterModelsByOrganization(
                $authorization->getOrganizationCode(),
                $allAggregateImageModels
            );
        } else {
            // 如果没有组织过滤器，返回所有模型（开源版本行为）
            $providerImageModels = $allAggregateImageModels;
        }

        // 转换为DTO数组
        $modeAggregateDTOs = [];
        foreach ($modeAggregates as $aggregate) {
            $modeAggregateDTOs[$aggregate->getMode()->getIdentifier()] = ModeAssembler::aggregateToDTO($aggregate, $providerModels, $upgradeRequiredModelIds, $providerImageModels);
        }

        // 处理图标URL转换
        foreach ($modeAggregateDTOs as $aggregateDTO) {
            $this->processModeAggregateIcons($aggregateDTO);
        }

        $list = [];
        foreach ($allAgents as $agent) {
            $modeAggregateDTO = $modeAggregateDTOs[$agent->getCode()] ?? null;
            if (! $modeAggregateDTO) {
                // 使用默认的
                $modeAggregateDTO = $modeAggregateDTOs['default'] ?? null;
            }
            if (! $modeAggregateDTO) {
                continue;
            }
            // 如果没有配置任何模型，要被过滤
            if (empty($modeAggregateDTO->getAllModelIds())) {
                continue;
            }
            $iconUrl = $agent->getIcon()['url'] ?? '';
            // 替换为智能组织处理后的 URL
            if (isset($agentIconUrls[$iconUrl])) {
                $iconUrl = $agentIconUrls[$iconUrl]->getUrl();
            }

            // 转换
            $list[] = [
                'mode' => [
                    'id' => $agent->getCode(),
                    'name' => $agent->getName(),
                    'placeholder' => $agent->getDescription(),
                    'identifier' => $agent->getCode(),
                    'icon_type' => $agent->getIconType(),
                    'icon_url' => $iconUrl,
                    'icon' => $agent->getIcon()['type'] ?? '',
                    'color' => $agent->getIcon()['color'] ?? '',
                    'sort' => 0,
                ],
                'agent' => [
                    'type' => $agent->getType()->value,
                    'category' => $agent->getCategory(),
                ],
                'groups' => $modeAggregateDTO->toArray()['groups'] ?? [],
            ];
        }

        return [
            'total' => count($list),
            'list' => $list,
        ];
    }

    /**
     * @return ModeGroupDetailDTO[]
     */
    public function getModeByIdentifier(MagicUserAuthorization $authorization, string $identifier): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();
        $modeAggregate = $this->modeDomainService->getModeDetailByIdentifier($modeDataIsolation, $identifier);

        $providerModels = $this->getModels($modeAggregate);
        $modeGroupDetailDTOS = ModeAssembler::aggregateToFlatGroupsDTO($modeAggregate, $providerModels);

        // 处理图标路径转换为完整URL
        $this->processModeGroupDetailIcons($authorization, $modeGroupDetailDTOS);

        return $modeGroupDetailDTOS;
    }

    public function getFeaturedAgent(MagicUserAuthorization $authorization): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();
        $language = $modeDataIsolation->getLanguage();

        // 获取目前的所有可用的 agent
        $superMagicAgentV2AppService = di(SuperMagicAgentAppService::class);
        $agentData = $superMagicAgentV2AppService->getFeaturedAgent($authorization);

        // 获取预设场景
        $playbooksByCode = $agentData['playbooks'] ?? [];

        // 合并常用和全部 agent 列表，常用在前
        /** @var array<SuperMagicAgentEntity> $allAgents */
        $allAgents = array_merge($agentData['frequent'], $agentData['all']);
        if (empty($allAgents)) {
            return [];
        }

        // 获取后台的所有模式，用于封装数据到 Agent 中
        $query = new ModeQuery(status: true);
        $modeEnabledList = $this->modeDomainService->getModes($modeDataIsolation, $query, Page::createNoPage())['list'];

        // 批量构建模式聚合根
        $modeAggregates = $this->modeDomainService->batchBuildModeAggregates($modeDataIsolation, $modeEnabledList);
        $modeRuntimeData = $this->buildModeRuntimeData($authorization, $modeAggregates);
        $modeAggregateDTOs = $modeRuntimeData['mode_aggregates'];

        $list = [];
        foreach ($allAgents as $agent) {
            $modeAggregateDTO = $modeAggregateDTOs[$agent->getCode()] ?? null;
            if (! $modeAggregateDTO) {
                // 使用默认的
                $modeAggregateDTO = $modeAggregateDTOs['default'] ?? null;
            }
            if (! $modeAggregateDTO) {
                continue;
            }

            // 如果没有配置任何模型，要被过滤
            if (empty($modeAggregateDTO->getAllModelIds())) {
                continue;
            }

            $playbookArray = [];
            $playbookEntities = $playbooksByCode[$agent->getCode()] ?? [];
            foreach ($playbookEntities as $playbookEntity) {
                $playbookArray[] = [
                    'id' => (string) $playbookEntity->getId(),
                    'name' => $playbookEntity->getI18nName($language),
                    'description' => $playbookEntity->getI18nDescription($language),
                    'icon' => $playbookEntity->getIcon(),
                    'theme_color' => $playbookEntity->getThemeColor(),
                ];
            }

            // 转换
            $list[] = [
                'mode' => [
                    'id' => $agent->getCode(),
                    'name' => $agent->getName(),
                    'description' => $agent->getDescription(),
                    'placeholder' => $modeAggregateDTO->getMode()->getPlaceholder(),
                    'identifier' => $agent->getCode(),
                    'icon_type' => $agent->getIconType(),
                    'icon_url' => $agent->getIcon()['url'] ?? '',
                    'icon' => $agent->getIcon()['type'] ?? '',
                    'color' => $agent->getIcon()['color'] ?? '',
                    'playbooks' => $playbookArray,
                    'sort' => 0,
                ],
                'agent' => [
                    'type' => $agent->getType()->value,
                    'category' => $agent->getCategory(),
                ],
                'groups' => $this->buildModeGroups($modeAggregateDTO),
            ];
        }

        return [
            'total' => count($list),
            'list' => $list,
            'models' => $modeRuntimeData['models'],
        ];
    }

    public function show(MagicUserAuthorization $authorization, string $identifier): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        $modeAggregate = $this->modeDomainService->getModeDetailByIdentifier($modeDataIsolation, $identifier);
        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        $modeRuntimeData = $this->buildModeRuntimeData($authorization, [$modeAggregate]);
        $modeAggregateDTO = $modeRuntimeData['mode_aggregates'][$identifier] ?? null;
        if (! $modeAggregateDTO) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        return [
            'mode' => [
                'id' => (string) $modeAggregate->getMode()->getId(),
                'name' => $modeAggregate->getMode()->getName(),
                'description' => $modeAggregate->getMode()->getDescription(),
                'placeholder' => $modeAggregate->getMode()->getPlaceholder(),
                'identifier' => $modeAggregate->getMode()->getIdentifier(),
                'icon_type' => $modeAggregate->getMode()->getIconType(),
                'icon_url' => $this->resolveModeIconUrl($modeAggregate),
                'icon' => $modeAggregate->getMode()->getIcon(),
                'color' => $modeAggregate->getMode()->getColor(),
                'playbooks' => [],
                'sort' => $modeAggregate->getMode()->getSort(),
            ],
            'agent' => [
                'type' => 1,
                'category' => 'all',
            ],
            'models' => $modeRuntimeData['models'],
            'groups' => $this->buildModeGroups($modeAggregateDTO),
        ];
    }

    /**
     * @param ModeAggregate[] $modeAggregates
     * @return array{mode_aggregates: array<string, ModeAggregateDTO>, models: array<string, mixed>}
     */
    private function buildModeRuntimeData(MagicUserAuthorization $authorization, array $modeAggregates): array
    {
        if (empty($modeAggregates)) {
            return [
                'mode_aggregates' => [],
                'models' => [],
            ];
        }

        $allProviderModelsWithStatus = $this->getProviderModelsByModeAggregates($modeAggregates);

        $allAggregateModels = [];
        foreach ($modeAggregates as $aggregate) {
            $aggregateModels = $this->getModelsForAggregate($aggregate, $allProviderModelsWithStatus);
            $allAggregateModels = array_merge($allAggregateModels, $aggregateModels);
        }

        $allAggregateImageModels = [];
        foreach ($modeAggregates as $aggregate) {
            $aggregateImageModels = $this->getImageModelsForAggregate($aggregate, $allProviderModelsWithStatus);
            $allAggregateImageModels = array_merge($allAggregateImageModels, $aggregateImageModels);
        }

        $upgradeRequiredModelIds = [];
        if ($this->organizationModelFilter) {
            $providerModels = $this->organizationModelFilter->filterModelsByOrganization(
                $authorization->getOrganizationCode(),
                $allAggregateModels
            );
            $providerImageModels = $this->organizationModelFilter->filterModelsByOrganization(
                $authorization->getOrganizationCode(),
                $allAggregateImageModels
            );
            $upgradeRequiredModelIds = $this->organizationModelFilter->getUpgradeRequiredModelIds($authorization->getOrganizationCode());
        } else {
            $providerModels = $allAggregateModels;
            $providerImageModels = $allAggregateImageModels;
        }

        $modeAggregateDTOs = [];
        foreach ($modeAggregates as $aggregate) {
            $modeAggregateDTOs[$aggregate->getMode()->getIdentifier()] = ModeAssembler::aggregateToDTO(
                $aggregate,
                $providerModels,
                $upgradeRequiredModelIds,
                $providerImageModels
            );
        }

        $allModels = [];
        foreach ($modeAggregateDTOs as $aggregateDTO) {
            $this->processModeAggregateIcons($aggregateDTO);
            foreach ($aggregateDTO->getGroups() as $groupAggregateDTO) {
                foreach ($groupAggregateDTO->getModels() as $model) {
                    $allModels[$model->getId()] = $model;
                }
                foreach ($groupAggregateDTO->getImageModels() as $imageModel) {
                    $allModels[$imageModel->getId()] = $imageModel;
                }
            }
        }

        return [
            'mode_aggregates' => $modeAggregateDTOs,
            'models' => $allModels,
        ];
    }

    private function buildModeGroups(ModeAggregateDTO $modeAggregateDTO): array
    {
        $modeGroups = [];
        foreach ($modeAggregateDTO->getGroups() as $group) {
            $modeGroups[] = [
                'group' => $group->getGroup()->toArray(),
                'model_ids' => array_map(fn ($model) => $model->getId(), $group->getModels()),
                'image_model_ids' => array_map(fn ($model) => $model->getId(), $group->getImageModels()),
            ];
        }

        return $modeGroups;
    }

    private function resolveModeIconUrl(ModeAggregate $modeAggregate): string
    {
        $iconPath = EasyFileTools::formatPath($modeAggregate->getMode()->getIconUrl());
        if ($iconPath === '') {
            return '';
        }

        $iconUrls = $this->getIconsWithSmartOrganization([$iconPath]);
        return $iconUrls[$iconPath]?->getUrl() ?? $iconPath;
    }

    /**
     * 批量获取模型和服务商状态（性能优化版本）.
     * @param array $allModelIds 所有需要查询的modelId
     * @return array<string, ProviderModelEntity> 已通过级联状态筛选的可用模型
     */
    private function getModelsBatch(array $allModelIds): array
    {
        if (empty($allModelIds)) {
            return [];
        }

        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());

        // 批量获取模型
        $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, $allModelIds);

        // 提取所有服务商ID
        $providerConfigIds = [];
        foreach ($allModels as $models) {
            foreach ($models as $model) {
                $providerConfigIds[] = $model->getServiceProviderConfigId();
            }
        }

        // 批量获取服务商状态（第2次SQL查询）
        $providerStatuses = [];
        if (! empty($providerConfigIds)) {
            $providerConfigs = $this->providerConfigDomainService->getByIds($providerDataIsolation, array_unique($providerConfigIds));
            foreach ($providerConfigs as $config) {
                $providerStatuses[$config->getId()] = $config->getStatus();
            }
        }

        // 应用级联状态筛选，返回可用模型
        $availableModels = [];
        foreach ($allModels as $modelId => $models) {
            $bestModel = $this->selectBestModelForBatch($models, $providerStatuses);
            if ($bestModel) {
                $availableModels[$modelId] = $bestModel;
            }
        }

        return $availableModels;
    }

    /**
     * 为批量查询优化的模型选择方法.
     * @param ProviderModelEntity[] $models 模型列表
     * @param array $providerStatuses 服务商状态映射
     */
    private function selectBestModelForBatch(array $models, array $providerStatuses): ?ProviderModelEntity
    {
        if (empty($models)) {
            return null;
        }

        // 优先选择服务商启用且模型启用的模型
        foreach ($models as $model) {
            // 动态模型忽略服务商状态检查
            if ($model->isDynamicModel()) {
                if ($model->getStatus() && $model->getStatus()->value === Status::Enabled->value) {
                    return $model;
                }
                continue;
            }

            $providerId = $model->getServiceProviderConfigId();
            $providerStatus = $providerStatuses[$providerId] ?? Status::Disabled;

            // 服务商禁用，跳过该模型
            if ($providerStatus === Status::Disabled) {
                continue;
            }

            // 服务商启用，检查模型状态
            if ($model->getStatus() && $model->getStatus()->value === Status::Enabled->value) {
                return $model;
            }
        }

        return null;
    }

    /**
     * 从批量查询结果中提取特定聚合根的模型（LLM）.
     * @param ModeAggregate $aggregate 模式聚合根
     * @param array<string, ProviderModelEntity> $allProviderModels 批量查询的所有模型结果
     * @return array<string, ProviderModelEntity> 该聚合根相关的模型
     */
    private function getModelsForAggregate(ModeAggregate $aggregate, array $allProviderModels): array
    {
        $aggregateModels = [];

        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $modelId = $relation->getModelId();

                if (! $providerModel = $allProviderModels[$modelId] ?? null) {
                    continue;
                }

                // 排除VLM类型的模型（VLM模型应该通过getImageModelsForAggregate处理）
                if ($providerModel->getCategory() === Category::VLM) {
                    continue;
                }

                // 动态模型跳过 isSupportFunction 检查（动态模型是虚拟模型，不需要检查 function 支持）
                if (! $providerModel->isDynamicModel() && ! $providerModel->getConfig()->isSupportFunction()) {
                    continue;
                }

                $aggregateModels[$modelId] = $providerModel;
            }
        }

        return $aggregateModels;
    }

    /**
     * 从批量查询结果中提取特定聚合根的图像模型（VLM）.
     * @param ModeAggregate $aggregate 模式聚合根
     * @param array<string, ProviderModelEntity> $allProviderModels 批量查询的所有模型结果
     * @return array<string, ProviderModelEntity> 该聚合根相关的图像模型
     */
    private function getImageModelsForAggregate(ModeAggregate $aggregate, array $allProviderModels): array
    {
        $aggregateImageModels = [];

        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $modelId = $relation->getModelId();

                if (! $providerModel = $allProviderModels[$modelId] ?? null) {
                    continue;
                }
                // 只返回 VLM 类型的模型
                if ($providerModel->getCategory() !== Category::VLM) {
                    continue;
                }
                $aggregateImageModels[$modelId] = $providerModel;
            }
        }

        return $aggregateImageModels;
    }

    /**
     * @return array<string, ProviderModelEntity> 已通过级联状态筛选的可用模型
     */
    private function getProviderModelsByModeAggregates(array $modeAggregates): array
    {
        // 步骤1：预收集所有需要的modelId
        $allModelIds = [];
        foreach ($modeAggregates as $aggregate) {
            foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
                foreach ($groupAggregate->getRelations() as $relation) {
                    $allModelIds[] = $relation->getModelId();
                }
            }
        }

        // 步骤2：批量查询所有模型和服务商状态
        return $this->getModelsBatch(array_unique($allModelIds));
    }
}
