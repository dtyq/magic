<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Facade;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicUserSettingRepositoryInterface
{
    public function save(DataIsolation $dataIsolation, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity;

    public function get(DataIsolation $dataIsolation, string $key): ?MagicUserSettingEntity;

    // 通过 magicId 维度存取
    public function saveByMagicId(string $magicId, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity;

    public function getByMagicId(string $magicId, string $key): ?MagicUserSettingEntity;

    /**
     * 全局配置：organization_code/user_id/magic_id 全部为 null.
     */
    public function getGlobal(string $key): ?MagicUserSettingEntity;

    /**
     * 保存全局配置。
     */
    public function saveGlobal(MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity;

    /**
     * 获取组织级配置（user_id/magic_id 均为 NULL）。
     */
    public function getByOrganizationCode(string $organizationCode, string $key): ?MagicUserSettingEntity;

    /**
     * 保存组织级配置。
     */
    public function saveByOrganizationCode(string $organizationCode, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity;

    /**
     * @return array{total: int, list: array<MagicUserSettingEntity>}
     */
    public function queries(DataIsolation $dataIsolation, MagicUserSettingQuery $query, Page $page): array;
}
