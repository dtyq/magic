<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Service;

use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\AppMenu\Repository\Facade\AppMenuRepositoryInterface;
use App\ErrorCode\AppMenuErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

readonly class AppMenuDomainService
{
    public function __construct(
        private AppMenuRepositoryInterface $appMenuRepository
    ) {
    }

    public function getById(int $id): ?AppMenuEntity
    {
        return $this->appMenuRepository->getById($id);
    }

    public function getByPath(string $appPath): ?AppMenuEntity
    {
        return $this->appMenuRepository->getByPath($appPath);
    }

    /**
     * @param array{name?: string, display_scope?: int} $filters
     * @return array{total: int, list: array<AppMenuEntity>}
     */
    public function queries(array $filters, Page $page): array
    {
        return $this->appMenuRepository->queries($filters, $page);
    }

    public function save(AppMenuEntity $savingEntity, string $currentUserId): AppMenuEntity
    {
        if ($savingEntity->shouldCreate()) {
            $entity = clone $savingEntity;
            $entity->setCreatorId($currentUserId);
            $entity->prepareForCreation();
        } else {
            $id = $savingEntity->getId();
            if ($id === null) {
                ExceptionBuilder::throw(AppMenuErrorCode::IdRequiredForUpdate, 'app_menu.id_required_for_update');
            }

            $entity = $this->appMenuRepository->getById($id);
            if (! $entity) {
                ExceptionBuilder::throw(AppMenuErrorCode::NotFound, 'app_menu.not_found');
            }

            $savingEntity->prepareForModification($entity);
        }

        return $this->appMenuRepository->save($entity);
    }

    public function delete(int $id): bool
    {
        $entity = $this->appMenuRepository->getById($id);
        if (! $entity) {
            ExceptionBuilder::throw(AppMenuErrorCode::NotFound, 'app_menu.not_found');
        }

        return $this->appMenuRepository->delete($id);
    }

    public function updateStatus(int $id, int $status): AppMenuEntity
    {
        $entity = $this->appMenuRepository->getById($id);
        if (! $entity) {
            ExceptionBuilder::throw(AppMenuErrorCode::NotFound, 'app_menu.not_found');
        }

        $entity->setStatus($status);

        return $this->appMenuRepository->save($entity);
    }

    /**
     * @param array<int> $displayScopes
     * @return array<AppMenuEntity>
     */
    public function getAllEnabled(array $displayScopes): array
    {
        return $this->appMenuRepository->getAllEnabled($displayScopes);
    }
}
