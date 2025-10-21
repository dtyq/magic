<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Repository\Facade;

use App\Domain\Organization\Entity\OrganizationAdminPlusWhitelistEntity;

interface OrganizationAdminPlusWhitelistRepositoryInterface
{
    public function getByOrganizationCode(string $organizationCode): ?OrganizationAdminPlusWhitelistEntity;

    public function save(OrganizationAdminPlusWhitelistEntity $entity): OrganizationAdminPlusWhitelistEntity;

    public function deleteByOrganizationCode(string $organizationCode): void;

    public function deleteById(int $id): void;

    /**
     * @return array{total:int,list:OrganizationAdminPlusWhitelistEntity[]}
     */
    public function queries(?string $organizationCode, int $page, int $pageSize): array;
}
