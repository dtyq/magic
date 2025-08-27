<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Log\LoggerInterface;

abstract class AbstractModeAppService
{
    public function __construct(
        protected ModeDomainService $modeDomainService,
        protected ProviderModelDomainService $providerModelDomainService,
        protected ModeGroupDomainService $groupDomainService,
        protected FileDomainService $fileDomainService,
        protected LoggerInterface $logger
    ) {
    }

    /**
     * 处理分组DTO数组中的图标，将路径转换为完整的URL.
     *
     * @param ModeGroupDTO[] $groups
     */
    protected function processGroupIcons(MagicUserAuthorization $authorization, array $groups): void
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

        // 批量获取icon的URL
        $iconUrls = $this->fileDomainService->getLinks(
            $authorization->getOrganizationCode(),
            $iconPaths,
            StorageBucketType::Public
        );

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
    protected function processModeAggregateIcons(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): void
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

        // 批量获取icon的URL
        $iconUrls = $this->fileDomainService->getLinks(
            $authorization->getOrganizationCode(),
            $iconPaths,
            StorageBucketType::Public
        );

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
     * @return ProviderModelEntity[]
     */
    protected function getModels(ModeAggregate $modeAggregate): array
    {
        // 获取所有模型ID
        $allModelIds = [];
        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $allModelIds[] = (string) $relation->getModelId();
            }
        }

        // 批量获取模型信息
        $providerModels = [];
        if (! empty($allModelIds)) {
            $providerDataIsolation = new ProviderDataIsolation();
            $providerDataIsolation->disabled();
            $providerModels = $this->providerModelDomainService->getModelsByIds($providerDataIsolation, $allModelIds);
        }
        return $providerModels;
    }
}
