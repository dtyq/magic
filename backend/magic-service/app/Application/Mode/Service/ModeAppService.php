<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;

class ModeAppService extends AbstractModeAppService
{
    public function getModes(MagicUserAuthorization $authorization): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        // 获取目前的所有可用的 agent
        $superMagicAgentAppService = di(SuperMagicAgentAppService::class);
        $agentData = $superMagicAgentAppService->queries($authorization, new SuperMagicAgentQuery(), Page::createNoPage());
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

        // 步骤3：套餐过滤 + 内存分配
        $currentPackage = $this->packageFilter->getCurrentPackage($authorization->getOrganizationCode());
        $providerModels = [];

        foreach ($modeAggregates as $aggregate) {
            // 从批量结果中提取当前聚合根的模型
            $aggregateModels = $this->getModelsForAggregate($aggregate, $allProviderModelsWithStatus);

            // 根据套餐进一步过滤模型
            foreach ($aggregateModels as $modelId => $model) {
                $visiblePackages = $model->getVisiblePackages();

                // 过滤规则：如果没有配置可见套餐，则对所有套餐可见
                if (empty($visiblePackages)) {
                    $providerModels[$modelId] = $model;
                    continue;
                }

                // 如果配置了可见套餐，检查当前套餐是否在其中
                if ($currentPackage && in_array($currentPackage, $visiblePackages)) {
                    $providerModels[$modelId] = $model;
                }
            }
        }

        // 转换为DTO数组
        $modeAggregateDTOs = [];
        foreach ($modeAggregates as $aggregate) {
            $modeAggregateDTOs[$aggregate->getMode()->getIdentifier()] = ModeAssembler::aggregateToDTO($aggregate, $providerModels);
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
            // 转换
            $list[] = [
                'mode' => [
                    'id' => $agent->getCode(),
                    'name' => $agent->getName(),
                    'placeholder' => $agent->getDescription(),
                    'identifier' => $agent->getCode(),
                    'icon' => $agent->getIcon()['type'] ?? '',
                    'color' => $agent->getIcon()['color'] ?? '',
                    'sort' => 0,
                ],
                'agent' => [
                    'type' => $agent->getType()->value,
                    'category' => $agent->getCategory(),
                ],
                'groups' => $modeAggregateDTO['groups'] ?? [],
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
     * 从批量查询结果中提取特定聚合根的模型.
     * @param ModeAggregate $aggregate 模式聚合根
     * @param array $allProviderModels 批量查询的所有模型结果
     * @return array<string, ProviderModelEntity> 该聚合根相关的模型
     */
    private function getModelsForAggregate(ModeAggregate $aggregate, array $allProviderModels): array
    {
        $aggregateModels = [];

        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $modelId = $relation->getModelId();

                // 从批量结果中获取模型（内存操作，无数据库查询）
                if (isset($allProviderModels[$modelId])) {
                    $aggregateModels[$modelId] = $allProviderModels[$modelId];
                }
            }
        }

        return $aggregateModels;
    }
}
