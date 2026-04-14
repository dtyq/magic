<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\AppMenu\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\AppMenu\Service\AppMenuDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use RuntimeException;

class AppMenuAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly AppMenuDomainService $appMenuDomainService,
    ) {
    }

    /**
     * @param array{name?: string, display_scope?: int} $filters
     * @return array{total: int, list: array<AppMenuEntity>}
     */
    public function queries(MagicUserAuthorization $authorization, array $filters, Page $page): array
    {
        return $this->appMenuDomainService->queries($filters, $page);
    }

    public function show(MagicUserAuthorization $authorization, int $id): AppMenuEntity
    {
        $entity = $this->appMenuDomainService->getById($id);
        if (! $entity) {
            throw new RuntimeException('App menu not found: ' . $id);
        }

        return $entity;
    }

    public function save(MagicUserAuthorization $authorization, AppMenuEntity $entity): AppMenuEntity
    {
        return $this->appMenuDomainService->save($entity, $authorization->getId());
    }

    public function delete(MagicUserAuthorization $authorization, int $id): bool
    {
        return $this->appMenuDomainService->delete($id);
    }

    public function updateStatus(MagicUserAuthorization $authorization, int $id, int $status): AppMenuEntity
    {
        return $this->appMenuDomainService->updateStatus($id, $status);
    }

    /**
     * @param array<int> $displayScopes
     * @return array<AppMenuEntity>
     */
    public function getAllEnabled(array $displayScopes): array
    {
        return $this->appMenuDomainService->getAllEnabled($displayScopes);
    }
}
