<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Repository\Facade;

use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;

interface AdminGlobalSettingsRepositoryInterface
{
    public function getSettingsByTypeAndOrganization(AdminGlobalSettingsType $type, string $organization): ?AdminGlobalSettingsEntity;

    public function updateSettings(AdminGlobalSettingsEntity $entity): AdminGlobalSettingsEntity;

    /**
     * @param AdminGlobalSettingsType[] $types
     * @return AdminGlobalSettingsEntity[]
     */
    public function getSettingsByTypesAndOrganization(array $types, string $organization): array;

    /**
     * @param AdminGlobalSettingsEntity[] $entities
     * @return AdminGlobalSettingsEntity[]
     */
    public function updateSettingsBatch(array $entities): array;
}
