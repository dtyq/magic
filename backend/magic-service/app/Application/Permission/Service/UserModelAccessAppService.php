<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class UserModelAccessAppService
{
    public function __construct(
        private readonly ModelAccessRoleDomainService $domainService,
    ) {
    }

    /**
     * @return array{
     *     permission_control_status:string,
     *     is_restricted:bool,
     *     denied_model_ids:list<string>,
     *     accessible_model_ids:list<string>,
     *     accessible_model_id_map:array<string, true>
     * }
     */
    public function resolveAccessContext(MagicUserAuthorization $authorization): array
    {
        $summary = $this->domainService->getUserSummary(
            PermissionDataIsolation::create($authorization->getOrganizationCode(), $authorization->getId(), $authorization->getMagicId()),
            $authorization->getId()
        );

        $status = $summary['permission_control_status'];
        $deniedModelIds = array_values(array_unique($summary['denied_model_ids']));
        $accessibleModelIds = array_values(array_unique($summary['accessible_model_ids']));
        $isRestricted = $status === PermissionControlStatus::ENABLED;

        return [
            'permission_control_status' => $status->value,
            'is_restricted' => $isRestricted,
            'denied_model_ids' => $deniedModelIds,
            'accessible_model_ids' => $accessibleModelIds,
            'accessible_model_id_map' => $isRestricted ? array_fill_keys($accessibleModelIds, true) : [],
        ];
    }

    public function isRestrictionEnabled(MagicUserAuthorization $authorization): bool
    {
        return $this->resolveAccessContext($authorization)['is_restricted'];
    }

    /**
     * @param list<string> $modelIds
     * @return list<string>
     */
    public function filterAccessibleModelIds(MagicUserAuthorization $authorization, array $modelIds): array
    {
        $context = $this->resolveAccessContext($authorization);
        if (! $context['is_restricted']) {
            return array_values($modelIds);
        }

        return array_values(array_filter(
            $modelIds,
            static fn (string $modelId): bool => isset($context['accessible_model_id_map'][$modelId])
        ));
    }

    /**
     * @template T
     * @param list<T> $entries
     * @param callable(T):string $modelIdResolver
     * @return list<T>
     */
    public function filterModelEntries(MagicUserAuthorization $authorization, array $entries, callable $modelIdResolver): array
    {
        $context = $this->resolveAccessContext($authorization);
        if (! $context['is_restricted']) {
            return array_values($entries);
        }

        return array_values(array_filter(
            $entries,
            static fn (mixed $entry): bool => isset($context['accessible_model_id_map'][$modelIdResolver($entry)])
        ));
    }
}
