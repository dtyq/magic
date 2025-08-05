<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\OrganizationAdminAppService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Permission\Assembler\OrganizationAdminAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class OrganizationAdminApi extends AbstractPermissionApi
{
    #[Inject]
    protected OrganizationAdminAppService $organizationAdminAppService;

    /**
     * 获取组织管理员列表.
     */
    public function list(): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();

        $page = intval($this->request->query('page', 1));
        $pageSize = intval($this->request->query('page_size', 10));
        $pageObject = new Page($page, $pageSize);
        $result = $this->organizationAdminAppService->queries($organizationCode, $pageObject);

        $listDto = OrganizationAdminAssembler::assembleListWithUserInfo($result['list']);
        $listDto->setTotal($result['total']);
        $listDto->setPage($page);
        $listDto->setPageSize($pageSize);
        return $listDto->toArray();
    }

    /**
     * 获取组织管理员详情.
     */
    public function show(int $id): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();

        $organizationAdminData = $this->organizationAdminAppService->show($organizationCode, $id);

        return OrganizationAdminAssembler::assembleWithUserInfo($organizationAdminData)->toArray();
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();
        $grantorUserId = $authorization->getId();

        $userId = $this->request->input('user_id');
        $remarks = $this->request->input('remarks');

        $organizationAdmin = $this->organizationAdminAppService->grant($organizationCode, $userId, $grantorUserId, $remarks);

        // 获取包含用户信息的完整数据
        $organizationAdminData = $this->organizationAdminAppService->show($organizationCode, $organizationAdmin->getId());

        return OrganizationAdminAssembler::assembleWithUserInfo($organizationAdminData)->toArray();
    }

    /**
     * 删除组织管理员.
     */
    public function destroy(int $id): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();

        $this->organizationAdminAppService->destroy($organizationCode, $id);

        // 返回空数组触发统一的 ApiResponse 封装，前端获得 {"code":1000,"message":"请求成功","data":{}}
        return [];
    }

    /**
     * 启用组织管理员.
     */
    public function enable(int $id): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();

        $this->organizationAdminAppService->enable($organizationCode, $id);

        // 返回空数组供 ApiResponse 统一封装
        return [];
    }

    /**
     * 禁用组织管理员.
     */
    public function disable(int $id): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();

        $this->organizationAdminAppService->disable($organizationCode, $id);

        return [];
    }
}
