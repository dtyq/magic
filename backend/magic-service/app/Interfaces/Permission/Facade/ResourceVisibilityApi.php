<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\ResourceVisibilityAppService;
use App\Interfaces\Permission\Assembler\ResourceVisibilityAssembler;
use App\Interfaces\Permission\DTO\ResourceVisibilityDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class ResourceVisibilityApi extends AbstractPermissionApi
{
    #[Inject]
    protected ResourceVisibilityAppService $resourceVisibilityAppService;

    /**
     * 批量保存资源可见性配置.
     */
    public function saveResourceVisibility(): array
    {
        $authorization = $this->getAuthorization();
        $dto = new ResourceVisibilityDTO($this->request->all());

        // 从DTO创建实体数组
        $entities = ResourceVisibilityAssembler::createEntitiesFromDTO(
            $dto,
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 调用应用服务
        $this->resourceVisibilityAppService->batchSaveResourceVisibility(
            $authorization,
            $dto->getResourceType(),
            $dto->getResourceCode(),
            $entities
        );

        return ['message' => 'Resource visibility saved successfully'];
    }

    /**
     * 查询资源可见性列表.
     */
    public function listResourceVisibility(): array
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();

        $resourceType = (int) ($params['resource_type'] ?? 0);
        $resourceCode = (string) ($params['resource_code'] ?? '');

        $entities = $this->resourceVisibilityAppService->listResourceVisibility(
            $authorization,
            $resourceType,
            $resourceCode
        );

        $dto = ResourceVisibilityAssembler::createDTOFromEntities($entities, $resourceType, $resourceCode);

        return $dto->toArray();
    }

    /**
     * 保存可见性配置(高层封装).
     */
    public function saveVisibilityConfig(): array
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();

        $resourceType = (int) ($params['resource_type'] ?? 0);
        $resourceCode = (string) ($params['resource_code'] ?? '');

        // 使用Assembler从请求参数创建领域层VisibilityConfig值对象
        $visibilityConfigData = $params['visibility_config'] ?? [];
        $visibilityConfig = ResourceVisibilityAssembler::createVisibilityConfigFromRequest($visibilityConfigData);

        // 调用应用服务
        $this->resourceVisibilityAppService->saveVisibilityConfig(
            $authorization,
            $resourceType,
            $resourceCode,
            $visibilityConfig
        );

        return ['message' => 'Visibility config saved successfully'];
    }

    /**
     * 查询可见性配置(高层封装).
     */
    public function getVisibilityConfig(): array
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();

        $resourceType = (int) ($params['resource_type'] ?? 0);
        $resourceCode = (string) ($params['resource_code'] ?? '');

        // 调用应用服务获取领域层VisibilityConfig值对象
        $visibilityConfigVO = $this->resourceVisibilityAppService->getVisibilityConfig(
            $authorization,
            $resourceType,
            $resourceCode
        );

        return [
            'resource_type' => $resourceType,
            'resource_code' => $resourceCode,
            'visibility_config' => $visibilityConfigVO->toArray(),
        ];
    }
}
