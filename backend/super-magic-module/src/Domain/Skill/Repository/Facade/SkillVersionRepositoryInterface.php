<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;

/**
 * Skill 版本仓储接口.
 */
interface SkillVersionRepositoryInterface
{
    /**
     * 根据 ID 查找 Skill 版本.
     */
    public function findById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity;

    /**
     * 保存 Skill 版本.
     */
    public function save(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity;

    /**
     * 根据 code 查找最新版本的 Skill 版本.
     */
    public function findLatestByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity;

    /**
     * 根据 code 查询当前版本或最新版本.
     */
    public function findCurrentOrLatestByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity;

    /**
     * 根据 code 列表批量查询当前版本或最新版本.
     *
     * @param array $codes Skill code 列表
     * @return array<string, SkillVersionEntity> key 为 skill code
     */
    public function findCurrentOrLatestByCodes(SkillDataIsolation $dataIsolation, array $codes): array;

    /**
     * 检查同一个 Skill 下版本号是否已存在.
     */
    public function existsByCodeAndVersion(SkillDataIsolation $dataIsolation, string $code, string $version): bool;

    /**
     * 根据 code 查找最新已发布版本的 Skill 版本.
     */
    public function findLatestPublishedByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity;

    /**
     * 根据 ID 查找待审核的技能版本.
     */
    public function findPendingReviewById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity;

    /**
     * 根据 code 查找所有已发布版本的 Skill 版本.
     *
     * @return SkillVersionEntity[]
     */
    public function findAllPublishedByCode(SkillDataIsolation $dataIsolation, string $code): array;

    /**
     * 根据 code 查找所有版本的 Skill 版本.
     *
     * @return SkillVersionEntity[]
     */
    public function findAllByCode(SkillDataIsolation $dataIsolation, string $code): array;

    /**
     * 根据 ID 查找 Skill 版本（不进行组织过滤，用于查询公开的商店技能版本）.
     */
    public function findByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity;

    /**
     * Batch query skill versions without organization filter.
     *
     * @return array<int, SkillVersionEntity>
     */
    public function findByIdsWithoutOrganizationFilter(array $ids): array;

    /**
     * 清空当前版本标记.
     */
    public function clearCurrentVersion(SkillDataIsolation $dataIsolation, string $code): int;

    /**
     * 查询版本列表.
     *
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queriesByCode(
        SkillDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array;
}
