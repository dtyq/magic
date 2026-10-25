<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Facade\Open;

use App\Application\Chat\Service\MagicDepartmentAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Contact\DTO\DepartmentQueryDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\UserQueryType;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\DTO\DepartmentPathNodeDTO;
use App\Interfaces\Chat\DTO\UserDepartmentDetailDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class MagicContactSandboxApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly MagicUserContactAppService $userContactAppService,
        private readonly MagicDepartmentAppService $departmentAppService,
    ) {
        parent::__construct($request);
    }

    public function searchUsers(): array
    {
        $authorization = $this->getSearchAuthorization();
        $query = new UserQueryDTO();
        $query->setQuery($this->getSearchQuery());
        $query->setPageToken($this->getPageToken());
        $query->setQueryType(UserQueryType::UserAndDepartmentFullPath);
        $query->setFilterAgent(true);
        $query->setPageSize(20);

        $result = $this->userContactAppService->searchDepartmentUser($query, $authorization);
        $users = [];
        $paths = [];
        foreach ($result['items'] ?? [] as $user) {
            if (! $user instanceof UserDepartmentDetailDTO || $user->getOrganizationCode() !== $authorization->getOrganizationCode()) {
                continue;
            }
            $users[] = $user;
            foreach ($user->getFullPathNodes() ?? [] as $pathNodes) {
                $node = is_array($pathNodes) ? end($pathNodes) : null;
                if ($node instanceof DepartmentPathNodeDTO) {
                    $paths[] = $node->getPath();
                }
            }
        }

        $visibleDepartments = $this->getVisibleDepartmentsForPaths($paths, $authorization);
        $items = [];
        foreach ($users as $user) {
            $departments = [];
            $fullPaths = $user->getFullPathNodes() ?? [];
            $firstDepartmentId = array_key_first($fullPaths);
            $titleDepartmentVisible = false;
            foreach ($fullPaths as $departmentId => $pathNodes) {
                $node = is_array($pathNodes) ? end($pathNodes) : null;
                if (! $node instanceof DepartmentPathNodeDTO) {
                    continue;
                }
                $pathNames = $this->getVisiblePathNames($node->getPath(), $node->getDepartmentId(), $visibleDepartments);
                if ($pathNames === null) {
                    continue;
                }
                if ($departmentId === $firstDepartmentId) {
                    $titleDepartmentVisible = true;
                }
                $departments[] = [
                    'department_id' => $node->getDepartmentId(),
                    'name' => $pathNames[count($pathNames) - 1],
                    'path_names' => $pathNames,
                ];
            }
            $items[] = [
                'user_id' => $user->getUserId(),
                'nickname' => $user->getNickname(),
                'real_name' => $user->getRealName(),
                'job_title' => $titleDepartmentVisible ? $user->getJobTitle() : '',
                'departments' => $departments,
            ];
        }

        return [
            'items' => $items,
            'has_more' => (bool) ($result['has_more'] ?? false),
            'page_token' => (string) ($result['page_token'] ?? ''),
        ];
    }

    public function searchDepartments(): array
    {
        $authorization = $this->getSearchAuthorization();
        $query = new DepartmentQueryDTO();
        $query->setQuery($this->getSearchQuery());

        $result = $this->departmentAppService->searchDepartment($query, $authorization);
        $departments = [];
        $paths = [];
        foreach ($result['items'] ?? [] as $department) {
            if (! $department instanceof MagicDepartmentEntity
                || $department->getOrganizationCode() !== $authorization->getOrganizationCode()) {
                continue;
            }
            $departments[] = $department;
            $paths[] = $department->getPath();
        }

        $visibleDepartments = $this->getVisibleDepartmentsForPaths($paths, $authorization);
        $items = [];
        foreach ($departments as $department) {
            $pathNames = $this->getVisiblePathNames($department->getPath(), (string) $department->getDepartmentId(), $visibleDepartments);
            if ($pathNames === null) {
                continue;
            }
            $items[] = [
                'department_id' => (string) $department->getDepartmentId(),
                'name' => (string) $department->getName(),
                'parent_department_id' => (string) $department->getParentDepartmentId(),
                'path_names' => $pathNames,
            ];
        }

        // The existing department repository returns at most 100 matches.
        return ['items' => $items, 'coverage' => 'bounded'];
    }

    /** @return array<string, MagicDepartmentEntity> */
    private function getVisibleDepartmentsForPaths(array $paths, MagicUserAuthorization $authorization): array
    {
        $ids = [];
        foreach ($paths as $path) {
            if (! is_string($path)) {
                continue;
            }
            foreach (explode('/', $path) as $id) {
                if ($id !== '') {
                    $ids[$id] = true;
                }
            }
        }
        if ($ids === []) {
            return [];
        }

        $query = new DepartmentQueryDTO();
        $query->setDepartmentIds(array_map('strval', array_keys($ids)));
        $visible = [];
        foreach ($this->departmentAppService->getDepartmentByIds($query, $authorization) as $department) {
            if ($department instanceof MagicDepartmentEntity
                && $department->getOrganizationCode() === $authorization->getOrganizationCode()) {
                $visible[(string) $department->getDepartmentId()] = $department;
            }
        }
        return $visible;
    }

    /** @param array<string, MagicDepartmentEntity> $visibleDepartments */
    private function getVisiblePathNames(?string $path, string $departmentId, array $visibleDepartments): ?array
    {
        if ($path === null) {
            return null;
        }
        $ids = explode('/', $path);
        if ($ids[0] !== PlatformRootDepartmentId::Magic || end($ids) !== $departmentId) {
            return null;
        }
        // 例：根部门/隐藏部门/可见子部门缺少隐藏节点时，不返回截短的路径或子部门。
        $names = [];
        foreach ($ids as $index => $id) {
            $department = $visibleDepartments[$id] ?? null;
            if ($department === null || ($index > 0 && $department->getParentDepartmentId() !== $ids[$index - 1])) {
                return null;
            }
            $names[] = (string) $department->getName();
        }
        return $names;
    }

    private function getSearchAuthorization(): MagicUserAuthorization
    {
        $authorization = RequestCoContext::getUserAuthorization();
        if (! $authorization instanceof MagicUserAuthorization
            || $authorization->getId() === ''
            || $authorization->getOrganizationCode() === ''
            || $authorization->getStatus() !== '1') {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied);
        }
        return $authorization;
    }

    private function getSearchQuery(): string
    {
        $rawQuery = $this->request->input('query', '');
        if (! is_string($rawQuery)) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
        }
        $query = trim($rawQuery);
        if ($query === '' || mb_strlen($query) > 100) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
        }
        return $query;
    }

    private function getPageToken(): string
    {
        $pageToken = $this->request->input('page_token', '');
        if (! is_string($pageToken)
            || ($pageToken !== '' && (! ctype_digit($pageToken) || strlen($pageToken) > 6 || (int) $pageToken > 100000))) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
        }
        return $pageToken;
    }
}
