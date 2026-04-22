<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
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
        $context = $this->domainService->resolveAccessContext(
            $this->createPermissionDataIsolation($authorization),
            $authorization->getId()
        );

        return $this->serializeAccessContext($context);
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

    protected function createPermissionDataIsolation(MagicUserAuthorization $authorization): PermissionDataIsolation
    {
        return PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $authorization->getMagicId()
        );
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
    private function serializeAccessContext(ModelAccessContext $context): array
    {
        return [
            'permission_control_status' => $context->getPermissionControlStatus()->value,
            'is_restricted' => $context->isRestricted(),
            'denied_model_ids' => $context->getDeniedModelIds(),
            'accessible_model_ids' => $context->getAccessibleModelIds(),
            'accessible_model_id_map' => $context->isRestricted() ? $context->getAccessibleModelIdMap() : [],
        ];
    }
}
