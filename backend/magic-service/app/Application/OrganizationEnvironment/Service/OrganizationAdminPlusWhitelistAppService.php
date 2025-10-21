<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\OrganizationEnvironment\Service;

use App\Domain\Organization\Service\OrganizationAdminPlusWhitelistDomainService;
use Hyperf\Di\Annotation\Inject;

class OrganizationAdminPlusWhitelistAppService
{
    #[Inject]
    protected OrganizationAdminPlusWhitelistDomainService $domainService;

    public function isWhitelisted(string $organizationCode): bool
    {
        return $this->domainService->isOrgWhitelisted($organizationCode);
    }

    public function upsert(string $organizationCode, bool $enabled): array
    {
        $entity = $this->domainService->upsert($organizationCode, $enabled);
        return [
            'id' => $entity->getId(),
            'organization_code' => $entity->getOrganizationCode(),
            'enabled' => $entity->isEnabled(),
        ];
    }

    public function delete(string $organizationCode): void
    {
        $this->domainService->delete($organizationCode);
    }

    public function deleteById(int $id): void
    {
        $this->domainService->deleteById($id);
    }

    public function queries(?string $organizationCode, int $page, int $pageSize): array
    {
        $result = $this->domainService->queries($organizationCode, $page, $pageSize);
        $list = [];
        foreach ($result['list'] as $entity) {
            $list[] = [
                'id' => $entity->getId(),
                'organization_code' => $entity->getOrganizationCode(),
                'enabled' => $entity->isEnabled(),
            ];
        }
        return ['total' => $result['total'], 'list' => $list];
    }
}
