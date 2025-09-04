<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
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

        // 获取所有相关的模型信息
        $allModelIds = [];
        foreach ($modeAggregates as $aggregate) {
            $allModelIds = array_merge($allModelIds, $aggregate->getAllModelIds());
        }
        $providerModels = [];
        if (! empty($allModelIds)) {
            $providerDataIsolation = new ProviderDataIsolation();
            $providerDataIsolation->disabled();
            $allProviderModels = $this->providerModelDomainService->getModelsByIds($providerDataIsolation, array_unique($allModelIds));

            // 根据套餐过滤模型
            $currentPackage = $this->packageFilter->getCurrentPackage($authorization->getOrganizationCode());
            foreach ($allProviderModels as $modelId => $model) {
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
}
