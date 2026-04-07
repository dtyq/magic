<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\Old\SuperMagicAgentOldAppService;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;

/**
 * 前台模式 app service。
 *
 * 统一视频参数设计落地后，这里只负责组织以下步骤：
 * - 查询并过滤当前组织可用模型
 * - 调用 domain service 解析 featured 视频配置
 * - 把结果交给 assembler 输出 DTO
 *
 * 不在这里实现 provider 能力规则和交集细节。
 */
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
        $modeAggregateDTOs = $this->buildModeAggregateDTOs($authorization, $modeAggregates);

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
        $modeAggregateDTOs = $this->buildModeAggregateDTOs($authorization, $modeAggregates);

        $allModels = [];
        foreach ($modeAggregateDTOs as $aggregateDTO) {
            foreach ($aggregateDTO->getGroups() as $groupAggregateDTO) {
                foreach ($groupAggregateDTO->getModels() as $model) {
                    $allModels[$model->getId()] = $model;
                }
                foreach ($groupAggregateDTO->getImageModels() as $imageModel) {
                    $allModels[$imageModel->getId()] = $imageModel;
                }
                foreach ($groupAggregateDTO->getVideoModels() as $videoModel) {
                    $allModels[$videoModel->getId()] = $videoModel;
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
                'model_ids' => array_map(static fn ($model) => $model->getId(), $group->getModels()),
                'image_model_ids' => array_map(static fn ($model) => $model->getId(), $group->getImageModels()),
                'video_model_ids' => array_map(static fn ($model) => $model->getId(), $group->getVideoModels()),
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
     * @param ModeAggregate[] $modeAggregates
     * @return array<string, ModeAggregateDTO>
     */
    private function buildModeAggregateDTOs(MagicUserAuthorization $authorization, array $modeAggregates): array
    {
        $allProviderModelsWithStatus = $this->getProviderModelsByModeAggregates($modeAggregates);

        $allAggregateModels = [];
        $allAggregateImageModels = [];
        $allAggregateVideoModels = [];
        foreach ($modeAggregates as $aggregate) {
            foreach ($this->getModelsForAggregate($aggregate, $allProviderModelsWithStatus) as $modelId => $model) {
                $allAggregateModels[$modelId] = $model;
            }
            foreach ($this->getImageModelsForAggregate($aggregate, $allProviderModelsWithStatus) as $modelId => $model) {
                $allAggregateImageModels[$modelId] = $model;
            }
            foreach ($this->getVideoModelsForAggregate($aggregate, $allProviderModelsWithStatus) as $modelId => $model) {
                $allAggregateVideoModels[$modelId] = $model;
            }
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
            $providerVideoModels = $this->organizationModelFilter->filterModelsByOrganization(
                $authorization->getOrganizationCode(),
                $allAggregateVideoModels
            );
            $upgradeRequiredModelIds = $this->organizationModelFilter->getUpgradeRequiredModelIds($authorization->getOrganizationCode());
        } else {
            $providerModels = $allAggregateModels;
            $providerImageModels = $allAggregateImageModels;
            $providerVideoModels = $allAggregateVideoModels;
        }

        // 按逻辑 model_id 预先求出 featured 视频能力配置，
        // assembler 只负责挂载，不再直接解析模型能力。
        $featuredVideoGenerationConfigs = $this->videoGenerationConfigDomainService->resolveFeatured(
            $this->buildVideoGenerationConfigCandidates(array_keys($providerVideoModels))
        );

        $modeAggregateDTOs = [];
        foreach ($modeAggregates as $aggregate) {
            $modeAggregateDTOs[$aggregate->getMode()->getIdentifier()] = ModeAssembler::aggregateToDTO(
                $aggregate,
                $providerModels,
                $upgradeRequiredModelIds,
                $providerImageModels,
                $providerVideoModels,
                $featuredVideoGenerationConfigs
            );
        }

        foreach ($modeAggregateDTOs as $aggregateDTO) {
            $this->processModeAggregateIcons($aggregateDTO);
        }

        return $modeAggregateDTOs;
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
        $groupedModels = $this->getModelGroupsBatch($allModelIds);

        return $this->filterAvailableModels($groupedModels, []);
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

                if (in_array($providerModel->getCategory(), [Category::VLM, Category::VGM], true)) {
                    continue;
                }

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
        return $this->getCategorizedModelsForAggregate($aggregate, $allProviderModels, Category::VLM);
    }

    /**
     * 从批量查询结果中提取特定聚合根的视频模型（VGM）.
     *
     * @param ModeAggregate $aggregate 模式聚合根
     * @param array<string, ProviderModelEntity> $allProviderModels 批量查询的所有模型结果
     * @return array<string, ProviderModelEntity> 该聚合根相关的视频模型
     */
    private function getVideoModelsForAggregate(ModeAggregate $aggregate, array $allProviderModels): array
    {
        // 这里只筛出视频类模型；同一逻辑模型多 provider 的去重在 assembler 中完成。
        return $this->getCategorizedModelsForAggregate($aggregate, $allProviderModels, Category::VGM);
    }

    /**
     * @param array<string, ProviderModelEntity> $allProviderModels
     * @return array<string, ProviderModelEntity>
     */
    private function getCategorizedModelsForAggregate(
        ModeAggregate $aggregate,
        array $allProviderModels,
        Category $category
    ): array {
        $aggregateModels = [];

        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $modelId = $relation->getModelId();

                if (! $providerModel = $allProviderModels[$modelId] ?? null) {
                    continue;
                }
                if ($providerModel->getCategory() !== $category) {
                    continue;
                }
                $aggregateModels[$modelId] = $providerModel;
            }
        }

        return $aggregateModels;
    }

    /**
     * @return array<string, ProviderModelEntity> 已通过级联状态筛选的可用模型
     */
    private function getProviderModelsByModeAggregates(array $modeAggregates): array
    {
        $allModelIds = [];
        foreach ($modeAggregates as $aggregate) {
            foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
                foreach ($groupAggregate->getRelations() as $relation) {
                    $allModelIds[] = $relation->getModelId();
                }
            }
        }

        return $this->getModelsBatch(array_unique($allModelIds));
    }
}
