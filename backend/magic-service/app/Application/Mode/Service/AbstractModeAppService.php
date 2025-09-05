<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Log\LoggerInterface;

abstract class AbstractModeAppService
{
    public function __construct(
        protected ModeDomainService $modeDomainService,
        protected ProviderModelDomainService $providerModelDomainService,
        protected ModeGroupDomainService $groupDomainService,
        protected FileDomainService $fileDomainService,
        protected LoggerInterface $logger,
        protected PackageFilterInterface $packageFilter
    ) {
    }

    /**
     * 处理分组DTO数组中的图标，将路径转换为完整的URL.
     *
     * @param ModeGroupDTO[] $groups
     */
    protected function processGroupIcons(array $groups): void
    {
        // 收集所有需要处理的icon路径
        $iconPaths = [];

        foreach ($groups as $group) {
            $groupIcon = $group->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon)) {
                $iconPaths[] = $groupIcon;
            }
        }

        // 如果没有需要处理的icon，直接返回
        if (empty($iconPaths)) {
            return;
        }

        // 去重
        $iconPaths = array_unique($iconPaths);

        // 批量获取icon的URL（自动按组织代码分组处理）
        $iconUrls = $this->fileDomainService->getBatchLinksByOrgPaths($iconPaths);

        // 替换DTO中的icon路径为完整URL
        foreach ($groups as $group) {
            $groupIcon = $group->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon) && isset($iconUrls[$groupIcon])) {
                $group->setIcon($iconUrls[$groupIcon]->getUrl());
            }
        }
    }

    /**
     * 处理模式聚合根中的图标，将路径转换为完整的URL.
     */
    protected function processModeAggregateIcons(AdminModeAggregateDTO|ModeAggregate|ModeAggregateDTO $modeAggregateDTO): void
    {
        // 收集所有需要处理的icon路径
        $iconPaths = [];

        // 收集分组的icon路径
        foreach ($modeAggregateDTO->getGroups() as $groupAggregate) {
            $groupIcon = $groupAggregate->getGroup()->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon)) {
                $iconPaths[] = $groupIcon;
            }

            // 收集模型的icon路径
            foreach ($groupAggregate->getModels() as $model) {
                $modelIcon = $model->getModelIcon();
                if (! empty($modelIcon) && ! is_url($modelIcon)) {
                    $iconPaths[] = $modelIcon;
                }
            }
        }

        // 如果没有需要处理的icon，直接返回
        if (empty($iconPaths)) {
            return;
        }

        // 去重
        $iconPaths = array_unique($iconPaths);

        // 批量获取icon的URL（自动按组织代码分组处理）
        $iconUrls = $this->fileDomainService->getBatchLinksByOrgPaths($iconPaths);

        // 替换DTO中的icon路径为完整URL
        foreach ($modeAggregateDTO->getGroups() as $groupAggregate) {
            $group = $groupAggregate->getGroup();
            $groupIcon = $group->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon) && isset($iconUrls[$groupIcon])) {
                $group->setIcon($iconUrls[$groupIcon]->getUrl());
            }

            // 替换模型的icon
            foreach ($groupAggregate->getModels() as $model) {
                $modelIcon = $model->getModelIcon();
                if (! empty($modelIcon) && ! is_url($modelIcon) && isset($iconUrls[$modelIcon])) {
                    $model->setModelIcon($iconUrls[$modelIcon]->getUrl());
                }
            }
        }
    }

    /**
     * 获取数据隔离对象
     */
    protected function getModeDataIsolation(MagicUserAuthorization $authorization): ModeDataIsolation
    {
        return new ModeDataIsolation($authorization->getOrganizationCode(), $authorization->getId());
    }

    /**
     * 处理ModeGroupDetailDTO数组中的图标，将路径转换为完整的URL.
     *
     * @param ModeGroupDetailDTO[] $modeGroupDetails
     */
    protected function processModeGroupDetailIcons(MagicUserAuthorization $authorization, array $modeGroupDetails): void
    {
        // 收集所有需要处理的icon路径
        $iconPaths = [];

        foreach ($modeGroupDetails as $groupDetail) {
            // 收集分组的icon路径
            $groupIcon = $groupDetail->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon)) {
                $iconPaths[] = $groupIcon;
            }

            // 收集模型的icon路径
            foreach ($groupDetail->getModels() as $model) {
                $modelIcon = $model->getModelIcon();
                if (! empty($modelIcon) && ! is_url($modelIcon)) {
                    $iconPaths[] = $modelIcon;
                }
            }
        }

        // 如果没有需要处理的icon，直接返回
        if (empty($iconPaths)) {
            return;
        }

        // 去重
        $iconPaths = array_unique($iconPaths);

        // 批量获取icon的URL（自动按组织代码分组处理）
        $iconUrls = $this->fileDomainService->getBatchLinksByOrgPaths($iconPaths);

        // 替换DTO中的icon路径为完整URL
        foreach ($modeGroupDetails as $groupDetail) {
            // 替换分组的icon
            $groupIcon = $groupDetail->getIcon();
            if (! empty($groupIcon) && ! is_url($groupIcon) && isset($iconUrls[$groupIcon])) {
                $groupDetail->setIcon($iconUrls[$groupIcon]->getUrl());
            }

            // 替换模型的icon
            foreach ($groupDetail->getModels() as $model) {
                $modelIcon = $model->getModelIcon();
                if (! empty($modelIcon) && ! is_url($modelIcon) && isset($iconUrls[$modelIcon])) {
                    $model->setModelIcon($iconUrls[$modelIcon]->getUrl());
                }
            }
        }
    }

    /**
     * @return ProviderModelEntity[]
     */
    protected function getModels(ModeAggregate $modeAggregate): array
    {
        // 获取所有模型ID (使用model_id而不是provider_model_id)
        $allModelIds = [];
        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $allModelIds[] = $relation->getModelId();
            }
        }

        // 批量获取模型信息
        $providerModels = [];
        if (! empty($allModelIds)) {
            $providerDataIsolation = new ProviderDataIsolation();
            $providerDataIsolation->disabled();
            $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, array_unique($allModelIds));

            // 为每个model_id选择最佳模型
            foreach ($allModels as $modelId => $models) {
                $bestModel = $this->selectBestModel($models);
                if ($bestModel) {
                    $providerModels[$modelId] = $bestModel;
                }
            }
        }
        return $providerModels;
    }

    /**
     * 获取详细的模型信息（用于管理后台精确状态判断）.
     * @return array<string, array{best: null|ProviderModelEntity, all: ProviderModelEntity[], status: string}>
     */
    protected function getDetailedModels(ModeAggregate $modeAggregate): array
    {
        // 获取所有模型ID
        $allModelIds = [];
        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $allModelIds[] = $relation->getModelId();
            }
        }

        if (empty($allModelIds)) {
            return [];
        }

        $providerDataIsolation = new ProviderDataIsolation();
        $providerDataIsolation->disabled();

        // 单次查询获取完整的模型信息
        $allModels = $this->providerModelDomainService->getModelsByModelIds($providerDataIsolation, array_unique($allModelIds));

        $result = [];
        foreach (array_unique($allModelIds) as $modelId) {
            $models = $allModels[$modelId] ?? [];
            $bestModel = $this->selectBestModel($models);
            $status = $this->determineStatus($models);

            $result[$modelId] = [
                'best' => $bestModel,
                'all' => $models,
                'status' => $status,
            ];
        }

        return $result;
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

        return null;
    }

    /**
     * 根据模型列表确定状态.
     *
     * @param ProviderModelEntity[] $models 模型列表
     * @return ModelStatus 状态：Normal、Disabled、Deleted
     */
    private function determineStatus(array $models): ModelStatus
    {
        if (empty($models)) {
            return ModelStatus::Deleted;
        }

        foreach ($models as $model) {
            if ($model->getStatus() && $model->getStatus() === Status::Enabled) {
                return ModelStatus::Normal;
            }
        }

        return ModelStatus::Disabled;
    }
}
