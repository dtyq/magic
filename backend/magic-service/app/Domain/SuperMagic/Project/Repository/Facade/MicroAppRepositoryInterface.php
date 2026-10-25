<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Facade;

use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppListScope;

interface MicroAppRepositoryInterface
{
    public function findById(int $id): ?MicroAppEntity;

    public function findByIdWithTrashed(int $id): ?MicroAppEntity;

    public function findByResourceIdWithTrashed(string $resourceId): ?MicroAppEntity;

    public function findByProjectId(int $projectId): ?MicroAppEntity;

    public function findByProjectIdWithTrashed(int $projectId): ?MicroAppEntity;

    public function ensureByProjectId(
        int $projectId,
        string $organizationCode,
        string $userId,
        string $creatorId
    ): MicroAppEntity;

    public function save(MicroAppEntity $entity): MicroAppEntity;

    public function deleteByProjectId(int $projectId): bool;

    public function restoreByProjectId(int $projectId): bool;

    public function restoreById(int $id): bool;

    public function forceDeleteById(int $id): bool;

    public function countActiveByOrganization(string $organizationCode): int;

    /**
     * @return MicroAppEntity[]
     */
    public function findPublishedByOrganization(string $organizationCode): array;

    /**
     * @param string[] $departmentIds
     * @param string[] $organizationCodes
     * @return array{total:int,list:array<int,array<string,mixed>>}
     */
    public function paginateAccessible(
        string $userId,
        array $departmentIds,
        array $organizationCodes,
        MicroAppListScope $scope,
        string $keyword,
        int $page,
        int $pageSize,
        bool $publishedOnly = false,
        bool $mentionableOnly = false,
    ): array;
}
