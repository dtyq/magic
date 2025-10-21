<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Service;

use App\Domain\Organization\Entity\OrganizationAdminPlusWhitelistEntity;
use App\Domain\Organization\Repository\Facade\OrganizationAdminPlusWhitelistRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class OrganizationAdminPlusWhitelistDomainService
{
    public function __construct(
        private readonly OrganizationAdminPlusWhitelistRepositoryInterface $repository,
        private readonly OrganizationRepositoryInterface $organizationRepository
    )
    {
    }

    public function isOrgWhitelisted(string $organizationCode): bool
    {
        $entity = $this->repository->getByOrganizationCode($organizationCode);
        return $entity !== null && $entity->isEnabled();
    }

    public function upsert(string $organizationCode, bool $enabled): OrganizationAdminPlusWhitelistEntity
    {
        // 校验组织编码是否存在
        $org = $this->organizationRepository->getByCode($organizationCode);
        if ($org === null) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        $entity = $this->repository->getByOrganizationCode($organizationCode) ?? new OrganizationAdminPlusWhitelistEntity();
        $entity->setOrganizationCode($organizationCode);
        $entity->setEnabled($enabled);
        return $this->repository->save($entity);
    }

    public function delete(string $organizationCode): void
    {
        $this->repository->deleteByOrganizationCode($organizationCode);
    }

    public function deleteById(int $id): void
    {
        $this->repository->deleteById($id);
    }

    /**
     * @return array{total:int,list:OrganizationAdminPlusWhitelistEntity[]}
     */
    public function queries(?string $organizationCode, int $page, int $pageSize): array
    {
        return $this->repository->queries($organizationCode, $page, $pageSize);
    }
}
