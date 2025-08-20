<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Kernel\Enum\MagicAdminResourceEnum;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Permission\Service\OrganizationAdminAppService;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Permission\Assembler\OrganizationAdminAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;

#[ApiResponse('low_code')]
class OrganizationAdminApi extends AbstractPermissionApi
{
    use DataIsolationTrait;

    #[Inject]
    protected OrganizationAdminAppService $organizationAdminAppService;

    /**
     * 获取组织管理员列表.
     */
    #[CheckPermission(MagicAdminResourceEnum::ORGANIZATION_ADMIN, MagicOperationEnum::QUERY)]
    public function list(): array
    {
        $authorization = $this->getAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);

        $page = intval($this->request->query('page', 1));
        $pageSize = intval($this->request->query('page_size', 10));
        $pageObject = new Page($page, $pageSize);
        $result = $this->organizationAdminAppService->queries($dataIsolation, $pageObject);

        $listDto = OrganizationAdminAssembler::assembleListWithUserInfo($result['list']);
        $listDto->setTotal($result['total']);
        $listDto->setPage($page);
        $listDto->setPageSize($pageSize);
        return $listDto->toArray();
    }

    /**
     * 获取组织管理员详情.
     */
    #[CheckPermission(MagicAdminResourceEnum::ORGANIZATION_ADMIN, MagicOperationEnum::QUERY)]
    public function show(int $id): array
    {
        $authorization = $this->getAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);

        $organizationAdminData = $this->organizationAdminAppService->show($dataIsolation, $id);

        return OrganizationAdminAssembler::assembleWithUserInfo($organizationAdminData)->toArray();
    }

    /**
     * 授予用户组织管理员权限.
     */
    #[CheckPermission(MagicAdminResourceEnum::ORGANIZATION_ADMIN, MagicOperationEnum::EDIT)]
    public function grant(): array
    {
        $authorization = $this->getAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);
        $grantorUserId = $authorization->getId();

        $userId = $this->request->input('user_id');
        $remarks = $this->request->input('remarks');

        $organizationAdmin = $this->organizationAdminAppService->grant($dataIsolation, $userId, $grantorUserId, $remarks);

        // 获取包含用户信息的完整数据
        $organizationAdminData = $this->organizationAdminAppService->show($dataIsolation, $organizationAdmin->getId());

        return OrganizationAdminAssembler::assembleWithUserInfo($organizationAdminData)->toArray();
    }

    /**
     * 删除组织管理员.
     */
    #[CheckPermission(MagicAdminResourceEnum::ORGANIZATION_ADMIN, MagicOperationEnum::EDIT)]
    public function destroy(int $id): array
    {
        $authorization = $this->getAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);

        $this->organizationAdminAppService->destroy($dataIsolation, $id);
        return [];
    }

    /**
     * 转让组织创建人身份.
     */
    #[CheckPermission(MagicAdminResourceEnum::ORGANIZATION_ADMIN, MagicOperationEnum::EDIT)]
    public function transferOwner(): array
    {
        $authorization = $this->getAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);
        $currentOwnerUserId = $authorization->getId();

        $newOwnerUserId = $this->request->input('user_id');
        if (empty($newOwnerUserId)) {
            throw new InvalidArgumentException('新的组织创建人用户ID不能为空');
        }

        $this->organizationAdminAppService->transferOwnership(
            $dataIsolation,
            $newOwnerUserId,
            $currentOwnerUserId
        );

        return [];
    }
}
