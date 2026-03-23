<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;

interface MagicClawRepositoryInterface
{
    /**
     * Create a new magic claw record.
     */
    public function create(MagicClawEntity $entity): MagicClawEntity;

    /**
     * Save (update) an existing magic claw record.
     */
    public function save(MagicClawEntity $entity): MagicClawEntity;

    /**
     * Find a magic claw by code with user and organization scope.
     */
    public function findByCode(string $code, string $userId, string $organizationCode): ?MagicClawEntity;

    /**
     * Soft-delete a magic claw record.
     */
    public function delete(MagicClawEntity $entity): bool;

    /**
     * Get paginated list of magic claws for a user within an organization.
     *
     * @return array{total: int, list: MagicClawEntity[]}
     */
    public function getList(string $userId, string $organizationCode, int $page, int $pageSize): array;

    /**
     * Update the project_id field for a given claw ID.
     */
    public function updateProjectId(int $id, int $projectId): bool;
}
