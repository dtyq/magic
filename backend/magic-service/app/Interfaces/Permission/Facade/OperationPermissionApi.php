<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Permission\Assembler\OperationPermissionAssembler;
use App\Interfaces\Permission\DTO\ResourceAccessDTO;
use App\Interfaces\Permission\DTO\ResourceTransferOwnerDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class OperationPermissionApi extends AbstractPermissionApi
{
    #[Inject]
    protected OperationPermissionAppService $operationPermissionAppService;

    public function transferOwner()
    {
        $authorization = $this->getAuthorization();
        $DTO = new ResourceTransferOwnerDTO($this->request->all());
        $resourceType = ResourceType::make($DTO->getResourceType());

        $this->operationPermissionAppService->transferOwner(
            $authorization,
            $resourceType,
            $DTO->getResourceId(),
            $DTO->getUserId(),
            $DTO->isReserveManager()
        );
    }

    public function resourceAccess()
    {
        $authorization = $this->getAuthorization();
        $resourceAccessDTO = new ResourceAccessDTO($this->request->all());

        $resourceType = ResourceType::make($resourceAccessDTO->getResourceType());
        $operationPermissions = OperationPermissionAssembler::createResourceAccessDO($resourceAccessDTO);

        $this->operationPermissionAppService->resourceAccess($authorization, $resourceType, $resourceAccessDTO->getResourceId(), $operationPermissions);
    }

    public function listResource()
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();
        $resourceType = ResourceType::from((int) ($params['resource_type'] ?? 0));
        $resourceId = (string) ($params['resource_id'] ?? '');
        $data = $this->operationPermissionAppService->listByResource($authorization, $resourceType, $resourceId);

        return OperationPermissionAssembler::createResourceAccessDTO($resourceType, $resourceId, $data['list'], $data['users'], $data['departments'], $data['groups']);
    }

    public function checkOrganizationAdmin(): array
    {
        $authorization = $this->getAuthorization();
        $isAdmin = PermissionChecker::isOrganizationAdmin($authorization->getOrganizationCode(), $authorization->getMobile());
        return ['is_admin' => $isAdmin];
    }

    /**
     * 获取用户拥有管理员权限的组织编码列表.
     */
    public function getUserOrganizationAdminList(): array
    {
        $organizationCodes = PermissionChecker::getUserOrganizationAdminList($this->getAuthorization()->getMagicId());

        return [
            'organization_codes' => $organizationCodes,
            'total' => count($organizationCodes),
        ];
    }
}
