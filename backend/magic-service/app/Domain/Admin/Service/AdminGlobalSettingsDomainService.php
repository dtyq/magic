<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Service;

use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminDataIsolation;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;

readonly class AdminGlobalSettingsDomainService
{
    public function __construct(
        private AdminGlobalSettingsRepositoryInterface $globalSettingsRepository
    ) {
    }

    public function getSettingsByType(AdminGlobalSettingsType $type, AdminDataIsolation $dataIsolation): AdminGlobalSettingsEntity
    {
        $settings = $this->globalSettingsRepository->getSettingsByTypeAndOrganization(
            $type,
            $dataIsolation->getCurrentOrganizationCode()
        );

        if ($settings === null) {
            // 创建默认设置
            $settings = $this->globalSettingsRepository->updateSettings(
                (new AdminGlobalSettingsEntity())
                    ->setType($type)
                    ->setOrganization($dataIsolation->getCurrentOrganizationCode())
                    ->setStatus(AdminGlobalSettingsStatus::DISABLED)
            );
        }

        return $settings;
    }

    public function updateSettings(
        AdminGlobalSettingsEntity $settings,
        AdminDataIsolation $dataIsolation
    ): AdminGlobalSettingsEntity {
        $settings->setOrganization($dataIsolation->getCurrentOrganizationCode());
        return $this->globalSettingsRepository->updateSettings($settings);
    }

    /**
     * @param AdminGlobalSettingsType[] $types
     * @return AdminGlobalSettingsEntity[]
     */
    public function getSettingsByTypes(array $types, AdminDataIsolation $dataIsolation): array
    {
        $settings = $this->globalSettingsRepository->getSettingsByTypesAndOrganization(
            $types,
            $dataIsolation->getCurrentOrganizationCode()
        );

        // 获取已存在的设置类型，使用 array_flip 优化查找
        $existingTypes = array_flip(array_map(fn ($setting) => $setting->getType()->value, $settings));

        // 找出不存在的设置类型
        $missingTypes = array_filter($types, function ($type) use ($existingTypes) {
            return ! isset($existingTypes[$type->value]);
        });

        if (! empty($missingTypes)) {
            // 批量创建不存在的设置
            $missingEntities = array_map(function ($type) use ($dataIsolation) {
                return (new AdminGlobalSettingsEntity())
                    ->setType($type)
                    ->setOrganization($dataIsolation->getCurrentOrganizationCode())
                    ->setStatus(AdminGlobalSettingsStatus::DISABLED);
            }, $missingTypes);

            // 批量更新不存在的设置
            $newSettings = $this->globalSettingsRepository->updateSettingsBatch($missingEntities);
            $settings = array_merge($settings, $newSettings);
        }

        return $settings;
    }

    /**
     * @param AdminGlobalSettingsEntity[] $entities
     * @return AdminGlobalSettingsEntity[]
     */
    public function updateSettingsBatch(array $entities, AdminDataIsolation $dataIsolation): array
    {
        foreach ($entities as $entity) {
            $entity->setOrganization($dataIsolation->getCurrentOrganizationCode());
        }
        return $this->globalSettingsRepository->updateSettingsBatch($entities);
    }
}
