<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Provider\Service\ModelIdentifierMappingAppService;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Provider\DTO\Request\BatchModelIdentifierMappingGroupsRequest;
use App\Interfaces\Provider\DTO\Request\ModelIdentifierMappingGroupIdRequest;
use App\Interfaces\Provider\DTO\Request\QueryModelIdentifierMappingGroupsRequest;
use App\Interfaces\Provider\DTO\Request\QueryModelIdentifierMappingOptionsRequest;
use App\Interfaces\Provider\DTO\Request\SaveModelIdentifierMappingGroupRequest;
use App\Interfaces\Provider\DTO\Request\UpdateModelIdentifierMappingStatusRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class ModelIdentifierMappingApi extends AbstractApi
{
    #[Inject]
    protected ModelIdentifierMappingAppService $appService;

    /**
     * 校验查询参数并返回映射组分页数据。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::QUERY)]
    public function query(QueryModelIdentifierMappingGroupsRequest $request): array
    {
        return $this->appService->queryGroups($this->getAuthorization(), $request->toDTO());
    }

    /**
     * 校验权限后返回单个映射组详情。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::QUERY)]
    public function get(ModelIdentifierMappingGroupIdRequest $request, string $groupId): array
    {
        $request->validated();
        return $this->appService->getGroup($this->getAuthorization(), $groupId);
    }

    /**
     * 校验保存参数并创建映射组。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function create(SaveModelIdentifierMappingGroupRequest $request): array
    {
        return $this->appService->saveGroup($this->getAuthorization(), $request->toDTO());
    }

    /**
     * 校验保存参数并更新映射组。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function update(SaveModelIdentifierMappingGroupRequest $request, string $groupId): array
    {
        return $this->appService->saveGroup($this->getAuthorization(), $request->toDTO(), $groupId);
    }

    /**
     * 校验单组状态并更新映射组启停状态。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function updateStatus(UpdateModelIdentifierMappingStatusRequest $request, string $groupId): array
    {
        $this->appService->updateStatus($this->getAuthorization(), $groupId, $request->getStatus());
        return [];
    }

    /**
     * 校验批量状态参数并执行批量启停。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function batchStatus(BatchModelIdentifierMappingGroupsRequest $request): array
    {
        $this->appService->batchUpdateStatus($this->getAuthorization(), $request->toDTO());
        return [];
    }

    /**
     * 删除指定映射组。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function delete(ModelIdentifierMappingGroupIdRequest $request, string $groupId): array
    {
        $request->validated();
        $this->appService->delete($this->getAuthorization(), $groupId);
        return [];
    }

    /**
     * 校验批量删除参数并删除映射组。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::EDIT)]
    public function batchDelete(BatchModelIdentifierMappingGroupsRequest $request): array
    {
        $this->appService->batchDelete($this->getAuthorization(), $request->toDTO());
        return [];
    }

    /**
     * 校验搜索词并返回源模型候选项。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::QUERY)]
    public function sourceOptions(QueryModelIdentifierMappingOptionsRequest $request): array
    {
        return $this->appService->modelOptions($this->getAuthorization(), $request->getKeyword());
    }

    /**
     * 校验搜索词并返回目标模型候选项。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_MODEL, MagicOperationEnum::QUERY)]
    public function targetOptions(QueryModelIdentifierMappingOptionsRequest $request): array
    {
        return $this->appService->modelOptions($this->getAuthorization(), $request->getKeyword());
    }
}
