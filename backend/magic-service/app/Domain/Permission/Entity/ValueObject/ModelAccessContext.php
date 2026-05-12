<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject;

final readonly class ModelAccessContext
{
    private PermissionControlStatus $permissionControlStatus;

    /**
     * @var list<string>
     */
    private array $deniedModelIds;

    /**
     * @var list<string>
     */
    private array $accessibleModelIds;

    /**
     * @var array<string, true>
     */
    private array $accessibleModelIdMap;

    /**
     * @param list<string> $deniedModelIds
     * @param list<string> $accessibleModelIds
     */
    public function __construct(
        PermissionControlStatus $permissionControlStatus,
        array $deniedModelIds,
        array $accessibleModelIds
    ) {
        $this->permissionControlStatus = $permissionControlStatus;
        $this->deniedModelIds = $this->normalizeModelIds($deniedModelIds);
        $this->accessibleModelIds = $this->normalizeModelIds($accessibleModelIds);
        $this->accessibleModelIdMap = array_fill_keys($this->accessibleModelIds, true);
    }

    public function getPermissionControlStatus(): PermissionControlStatus
    {
        return $this->permissionControlStatus;
    }

    public function isRestricted(): bool
    {
        return $this->permissionControlStatus === PermissionControlStatus::ENABLED;
    }

    public function canAccess(string $modelId): bool
    {
        return $modelId !== '' && isset($this->accessibleModelIdMap[$modelId]);
    }

    /**
     * @return list<string>
     */
    public function getDeniedModelIds(): array
    {
        return $this->deniedModelIds;
    }

    /**
     * @return list<string>
     */
    public function getAccessibleModelIds(): array
    {
        return $this->accessibleModelIds;
    }

    /**
     * @return array<string, true>
     */
    public function getAccessibleModelIdMap(): array
    {
        return $this->accessibleModelIdMap;
    }

    /**
     * @param list<string> $modelIds
     * @return list<string>
     */
    private function normalizeModelIds(array $modelIds): array
    {
        $result = [];
        foreach ($modelIds as $modelId) {
            if ($modelId === '') {
                continue;
            }
            $result[(string) $modelId] = (string) $modelId;
        }

        return array_values($result);
    }
}
