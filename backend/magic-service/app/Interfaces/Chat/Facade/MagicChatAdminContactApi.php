<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade;

use App\Application\Chat\Service\MagicDepartmentAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Application\Kernel\SuperPermissionEnum;
use App\Domain\Contact\DTO\DepartmentQueryDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Entity\ValueObject\DepartmentSumType;
use App\Domain\Contact\Entity\ValueObject\UserOption;
use App\Domain\Contact\Entity\ValueObject\UserQueryType;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\PermissionChecker;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 管理后台的通讯录接口,与开放平台的接口返回格式不同.
 */
#[ApiResponse('low_code')]
class MagicChatAdminContactApi extends AbstractApi
{
    public function __construct(
        private readonly MagicDepartmentAppService $departmentContactAppService,
        private readonly MagicUserContactAppService $userContactAppService,
    ) {
    }

    /**
     * 获取下级部门列表.
     */
    public function getSubList(string $id, RequestInterface $request): array
    {
        $pageToken = (string) $request->input('page_token', '');
        $sumType = (int) ($request->query('sum_type') ?: DepartmentSumType::DirectEmployee->value);
        $queryDTO = $this->getDepartmentQueryDTO($id, $pageToken, $sumType);
        $authorization = $this->getAuthorization();
        return $this->departmentContactAppService->getSubDepartments($queryDTO, $authorization)->toArray();
    }

    public function getDepartmentInfoById(string $id, RequestInterface $request): array
    {
        $pageToken = (string) $request->input('page_token', '');
        $sumType = (int) ($request->query('sum_type') ?: DepartmentSumType::DirectEmployee->value);
        $queryDTO = $this->getDepartmentQueryDTO($id, $pageToken, $sumType);
        $authorization = $this->getAuthorization();
        $departmentEntity = $this->departmentContactAppService->getDepartmentById($queryDTO, $authorization);
        return $departmentEntity ? $departmentEntity->toArray() : [];
    }

    public function departmentSearch(RequestInterface $request): array
    {
        $pageToken = (string) $request->query('page_token', '');
        $sumType = (int) ($request->query('sum_type') ?: DepartmentSumType::DirectEmployee->value);
        $queryDTO = $this->getDepartmentQueryDTO('', $pageToken, $sumType);
        $authorization = $this->getAuthorization();
        $queryDTO->setQuery((string) $request->query('name', ''));
        return $this->departmentContactAppService->searchDepartment($queryDTO, $authorization);
    }

    /**
     * 按用户id查询,返回用户以及他所在的部门信息.
     */
    public function userGetByIds(RequestInterface $request): array
    {
        $ids = $request->input('user_ids', '');
        // 上一页的token. 对于mysql来说,返回累积偏移量;对于es来说,返回游标
        $pageToken = (string) $request->input('page_token', '');
        $queryType = (int) ($request->input('query_type') ?: UserQueryType::User->value);
        if (! in_array($queryType, UserQueryType::types())) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => 'query_type']);
        }
        $queryType = UserQueryType::from($queryType);
        $listQuery = new UserQueryDTO();
        $listQuery->setPageToken($pageToken);
        $listQuery->setQueryType($queryType);
        $listQuery->setUserIds($ids);
        $authorization = $this->getAuthorization();
        return $this->userContactAppService->getUserDetailByIds($listQuery, $authorization);
    }

    /**
     * 查询部门直属用户列表.
     */
    public function departmentUserList(string $id, RequestInterface $request): array
    {
        // 部门id
        // 上一页的token. 对于mysql来说,返回累积偏移量;对于es来说,返回游标
        $pageToken = (string) $request->input('page_token', '');
        // 是否递归
        $recursive = (bool) $request->input('recursive', false);
        $listQuery = new UserQueryDTO();
        $listQuery->setDepartmentId($id);
        $listQuery->setPageToken($pageToken);
        $listQuery->setIsRecursive($recursive);
        $authorization = $this->getAuthorization();
        return $this->userContactAppService->getUsersDetailByDepartmentId($listQuery, $authorization);
    }

    public function searchForSelect(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();
        $query = (string) $request->input('query', '');
        // 上一页的token. 对于mysql来说,返回累积偏移量;对于es来说,返回游标
        $pageToken = (string) $request->input('page_token', '');
        if (empty($query)) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => 'query']);
        }
        $queryType = (int) $request->input('query_type', UserQueryType::User->value);
        if (! in_array($queryType, UserQueryType::types())) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => 'query_type']);
        }
        $filterAgent = (bool) $request->input('filter_agent', false);
        $queryType = UserQueryType::from($queryType);
        $listQuery = new UserQueryDTO();
        $listQuery->setQuery($query);
        $listQuery->setPageToken($pageToken);
        $listQuery->setQueryType($queryType);
        $listQuery->setFilterAgent($filterAgent);
        return $this->userContactAppService->searchDepartmentUser($listQuery, $authorization);
    }

    public function updateDepartmentsOptionByIds(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();

        if (! PermissionChecker::mobileHasPermission($authorization->getMobile(), SuperPermissionEnum::HIDE_USER_OR_DEPT)) {
            ExceptionBuilder::throw(ChatErrorCode::OPERATION_FAILED);
        }
        $userIds = (array) $request->input('department_ids', '');
        $option = $request->input('option');
        $option = is_numeric($option) ? DepartmentOption::tryFrom((int) $option) : null;
        return [
            'changed_num' => $this->departmentContactAppService->updateDepartmentsOptionByIds($userIds, $option),
        ];
    }

    public function updateUsersOptionByIds(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();
        if (! PermissionChecker::mobileHasPermission($authorization->getMobile(), SuperPermissionEnum::HIDE_USER_OR_DEPT)) {
            ExceptionBuilder::throw(ChatErrorCode::OPERATION_FAILED);
        }
        $userIds = (array) $request->input('user_ids', '');
        $option = $request->input('option');
        $option = is_numeric($option) ? UserOption::tryFrom((int) $option) : null;
        return [
            'changed_num' => $this->userContactAppService->updateUserOptionByIds($userIds, $option),
        ];
    }

    // 获取部门查询dto
    private function getDepartmentQueryDTO(string $id, string $pageToken, int $sumType): DepartmentQueryDTO
    {
        $queryDTO = new DepartmentQueryDTO();
        $queryDTO->setDepartmentId($id);
        $queryDTO->setSumType(DepartmentSumType::from($sumType));
        $queryDTO->setPageToken($pageToken);
        return $queryDTO;
    }
}
