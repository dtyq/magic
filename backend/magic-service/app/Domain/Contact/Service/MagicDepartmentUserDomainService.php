<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentUsersPageResponseDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;

readonly class MagicDepartmentUserDomainService
{
    public function __construct(
        private MagicDepartmentUserRepositoryInterface $departmentUserRepository,
    ) {
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function getDepartmentUsersByUserIds(array $userIds, DataIsolation $dataIsolation): array
    {
        return $this->departmentUserRepository->getDepartmentUsersByUserIds($userIds, $dataIsolation->getCurrentOrganizationCode());
    }

    public function getDepartmentUsersByUserIdsInMagic(array $userIds): array
    {
        return $this->departmentUserRepository->getDepartmentUsersByUserIdsInMagic($userIds);
    }

    public function getDepartmentUsersByDepartmentId(UserQueryDTO $contactUserListQueryDTO, DataIsolation $dataIsolation): DepartmentUsersPageResponseDTO
    {
        // 暂时不支持递归处理
        return $this->departmentUserRepository->getDepartmentUsersByDepartmentId(
            $contactUserListQueryDTO->getDepartmentId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $contactUserListQueryDTO->getPageSize(),
            (int) $contactUserListQueryDTO->getPageToken()
        );
    }

    /**
     * 获取部门和其所有子部门用户数量.
     */
    public function getDepartmentUsersByDepartmentIds(array $departmentIds, DataIsolation $dataIsolation, int $limit, array $fields = ['*']): array
    {
        return $this->departmentUserRepository->getDepartmentUsersByDepartmentIds(
            $departmentIds,
            $dataIsolation->getCurrentOrganizationCode(),
            $limit,
            $fields
        );
    }

    /**
     * 获取用户所在部门.
     * 一对多关系.
     */
    public function getDepartmentIdsByUserIds(DataIsolation $dataIsolation, array $userIds, bool $withAllParentIds = false): array
    {
        return $this->departmentUserRepository->getDepartmentIdsByUserIds($dataIsolation, $userIds, $withAllParentIds);
    }

    /**
     * 获取用户所在部门.
     * 一对多关系.
     */
    public function getDepartmentIdsByUserId(DataIsolation $dataIsolation, string $userId, bool $withAllParentIds = false): array
    {
        return $this->departmentUserRepository->getDepartmentIdsByUserIds($dataIsolation, [$userId], $withAllParentIds)[$userId] ?? [];
    }

    /**
     * @return MagicDepartmentUserEntity[]
     */
    public function searchDepartmentUsersByJobTitle(string $keyword, DataIsolation $dataIsolation): array
    {
        return $this->departmentUserRepository->searchDepartmentUsersByJobTitle($keyword, $dataIsolation->getCurrentOrganizationCode());
    }
}
