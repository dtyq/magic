<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Provider\DTO\BatchModelIdentifierMappingGroupsDTO;
use App\Application\Provider\DTO\QueryModelIdentifierMappingGroupsDTO;
use App\Application\Provider\DTO\SaveModelIdentifierMappingGroupDTO;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ModelIdentifierMappingDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class ModelIdentifierMappingAppService
{
    /**
     * 注入领域服务，应用层不直接访问仓储。
     */
    public function __construct(
        private readonly ModelIdentifierMappingDomainService $domainService,
    ) {
    }

    /**
     * 查询官方组织的模型标识映射组。
     */
    public function queryGroups(MagicUserAuthorization $authorization, QueryModelIdentifierMappingGroupsDTO $request): array
    {
        return $this->domainService->queryGroups(
            $this->createDataIsolation($authorization),
            $request->toQuery(),
            $request->toPage(),
        );
    }

    /**
     * 查询指定映射组的完整配置。
     */
    public function getGroup(MagicUserAuthorization $authorization, string $groupId): array
    {
        return $this->domainService->getGroup($this->createDataIsolation($authorization), $groupId);
    }

    /**
     * 创建或更新一个模型标识映射组。
     */
    public function saveGroup(MagicUserAuthorization $authorization, SaveModelIdentifierMappingGroupDTO $request, ?string $groupId = null): array
    {
        return $this->domainService->saveGroup(
            $this->createDataIsolation($authorization),
            $request->groupName,
            $request->sourceModelIds,
            $request->targetModelId,
            $groupId,
        );
    }

    /**
     * 更新单个映射组的启用状态。
     */
    public function updateStatus(MagicUserAuthorization $authorization, string $groupId, int $status): void
    {
        $this->domainService->updateStatus($this->createDataIsolation($authorization), $groupId, $status);
    }

    /**
     * 批量更新映射组状态，并在启用前一次性校验目标模型。
     */
    public function batchUpdateStatus(MagicUserAuthorization $authorization, BatchModelIdentifierMappingGroupsDTO $request): void
    {
        $this->domainService->batchUpdateStatus(
            $this->createDataIsolation($authorization),
            $request->groupIds,
            $request->status,
        );
    }

    /**
     * 删除单个映射组。
     */
    public function delete(MagicUserAuthorization $authorization, string $groupId): void
    {
        $this->domainService->deleteGroup($this->createDataIsolation($authorization), $groupId);
    }

    /**
     * 批量删除映射组。
     */
    public function batchDelete(MagicUserAuthorization $authorization, BatchModelIdentifierMappingGroupsDTO $request): void
    {
        $this->domainService->batchDelete($this->createDataIsolation($authorization), $request->groupIds);
    }

    /**
     * 查询源模型和目标模型共用的候选项。
     */
    public function modelOptions(MagicUserAuthorization $authorization, string $keyword = ''): array
    {
        return $this->domainService->modelOptions($this->createDataIsolation($authorization), $keyword);
    }

    /**
     * 将当前授权上下文转换为 Provider 领域数据隔离对象。
     */
    private function createDataIsolation(MagicUserAuthorization $authorization): ProviderDataIsolation
    {
        return ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId(),
        );
    }
}
