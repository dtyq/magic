<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class ModeAppService extends AbstractModeAppService
{
    public function getModes(MagicUserAuthorization $authorization): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        // 创建查询对象：sort降序，过滤默认模式
        $query = new ModeQuery('desc', true, true);
        $modesResult = $this->modeDomainService->getModes($modeDataIsolation, $query, new Page(1, 100));

        if (empty($modesResult['list'])) {
            return $modesResult;
        }

        // 批量构建模式聚合根
        $modeAggregates = $this->modeDomainService->batchBuildModeAggregates($modeDataIsolation, $modesResult['list']);

        // 获取所有模型ID (使用model_id而不是provider_model_id)
        $allModelIds = [];
        foreach ($modeAggregates as $aggregate) {
            foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
                foreach ($groupAggregate->getRelations() as $relation) {
                    $allModelIds[] = $relation->getModelId();
                }
            }
        }
        
        $providerModels = [];
        if (! empty($allModelIds)) {
            $providerDataIsolation = new ProviderDataIsolation();
            $providerDataIsolation->disabled();
            $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, array_unique($allModelIds));

            // 根据套餐过滤模型，并只选择可用模型
            $currentPackage = $this->packageFilter->getCurrentPackage($authorization->getOrganizationCode());
            foreach ($allModels as $modelId => $models) {
                $bestModel = $this->selectBestModel($models);
                if (! $bestModel) {
                    continue; // 前台不显示没有可用模型的情况
                }
                
                $visiblePackages = $bestModel->getVisiblePackages();
                // 过滤规则：如果没有配置可见套餐，则对所有套餐可见
                if (empty($visiblePackages)) {
                    $providerModels[$modelId] = $bestModel;
                    continue;
                }
                // 如果配置了可见套餐，检查当前套餐是否在其中
                if ($currentPackage && in_array($currentPackage, $visiblePackages)) {
                    $providerModels[$modelId] = $bestModel;
                }
            }
        }

        // 转换为DTO数组
        $modeAggregateDTOs = [];
        foreach ($modeAggregates as $aggregate) {
            $modeAggregateDTOs[] = ModeAssembler::aggregateToDTO($aggregate, $providerModels);
        }

        // 处理图标URL转换
        foreach ($modeAggregateDTOs as $aggregateDTO) {
            $this->processModeAggregateIcons($aggregateDTO);
        }

        return [
            'total' => $modesResult['total'],
            'list' => $modeAggregateDTOs,
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
     * 从模型列表中选择最佳模型.
     *
     * @param ProviderModelEntity[] $models 模型列表
     * @return null|ProviderModelEntity 选择的最佳模型，如果没有可用模型则返回null
     */
    private function selectBestModel(array $models): ?ProviderModelEntity
    {
        if (empty($models)) {
            return null;
        }

        // 策略1：优先选择启用状态的模型
        foreach ($models as $model) {
            if ($model->getStatus() && $model->getStatus()->value === Status::Enabled->value) {
                return $model;
            }
        }

        // 策略2：如果没有启用的模型，前台返回null（不显示不可用模型）
        return null;
    }
}
