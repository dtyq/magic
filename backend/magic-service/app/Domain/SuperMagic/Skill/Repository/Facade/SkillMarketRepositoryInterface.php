<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Facade;

use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 市场 Skill 仓储接口.
 */
interface SkillMarketRepositoryInterface
{
    /**
     * 获取已发布的官方内置 Skill 实体。
     *
     * @return array<int, SkillMarketEntity>
     */
    public function getOfficialBuiltinSkillEntities(): array;

    /**
     * 批量查询市场技能的最新版本信息（用于判断 need_upgrade）.
     *
     * @param array $skillCodes Skill code 列表（对应 magic_skills.version_code）
     * @return SkillMarketEntity[] 市场技能实体数组，key 为 skill_code
     */
    public function findLatestPublishedBySkillCodes(array $skillCodes): array;

    /**
     * 批量查询市场在架（已发布且未隐藏）的 Skill code.
     *
     * 与市场货架列表保持同一可见口径：publish_status = PUBLISHED 且 is_hidden = false。
     *
     * @param array<string> $skillCodes
     * @return array<string> 在架的市场 skill_code 列表
     */
    public function findPublishedSkillCodes(array $skillCodes): array;

    /**
     * 根据 skill_code 更新所有市场技能的发布状态（不限制当前状态）.
     *
     * @param string $skillCode Skill code
     * @param string $publishStatus 发布状态
     * @return bool 是否更新成功
     */
    public function updateAllPublishStatusBySkillCode(string $skillCode, string $publishStatus): bool;

    /**
     * 根据 skill_code 查找市场技能.
     *
     * @param string $skillCode Skill code
     * @return null|SkillMarketEntity 不存在返回 null
     */
    public function findBySkillCode(string $skillCode): ?SkillMarketEntity;

    public function findOfficialBySkillCode(string $organizationCode, string $skillCode): ?SkillMarketEntity;

    public function findOfficialByPackageName(string $packageName): ?SkillMarketEntity;

    /**
     * Find the latest published market skill by skill code.
     */
    public function findPublishedBySkillCode(string $skillCode): ?SkillMarketEntity;

    /**
     * 保存市场技能.
     *
     * @param SkillMarketEntity $entity 市场技能实体
     * @return SkillMarketEntity 保存后的实体
     */
    public function save(SkillMarketEntity $entity): SkillMarketEntity;

    /**
     * 查询市场技能列表（支持分页、关键词搜索、发布者类型筛选）.
     *
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{total: ?int, list: SkillMarketEntity[]} 总数（未请求时为 null）和市场技能实体数组
     */
    public function queries(
        SkillQuery $query,
        Page $page
    ): array;

    /**
     * 管理后台查询市场技能列表.
     *
     * @return array{total: int, list: SkillMarketEntity[]}
     */
    public function queryAdminMarkets(
        ?string $publishStatus,
        ?string $organizationCode,
        ?string $name18n,
        ?string $publisherType,
        ?string $skillCode,
        ?string $packageName,
        ?string $startTime,
        ?string $endTime,
        array $categoryIds,
        string $orderBy,
        Page $page
    ): array;

    /**
     * 根据 ID 查找市场技能.
     *
     * @param int $id 市场技能 ID
     * @return null|SkillMarketEntity 不存在返回 null
     */
    public function findById(int $id): ?SkillMarketEntity;

    /** Find one market record with its published Skill package name for semantic indexing. */
    public function findByIdForVectorIndex(int $id): ?SkillMarketEntity;

    /**
     * 根据 ID 查找市场技能（仅查询已发布的）.
     *
     * @param int $id 市场技能 ID
     * @return null|SkillMarketEntity 不存在返回 null
     */
    public function findPublishedById(int $id): ?SkillMarketEntity;

    /**
     * Batch query market skills by IDs.
     *
     * @return array<int, SkillMarketEntity>
     */
    public function findByIds(array $ids): array;

    /**
     * Batch query market skills that are authoritative candidates for public search.
     *
     * @param array<int, int|string> $ids
     * @return array<int, SkillMarketEntity>
     */
    public function findVisibleByIds(array $ids): array;

    /** Query published market skills missing SKILL.md by an ID cursor. */
    public function findPublishedWithoutSkillFileByIdCursor(int $afterId = 0, int $limit = 100): array;

    /**
     * Query published and visible market IDs for cursor-based vector reindexing.
     *
     * @param array<int, int|string> $categoryIds
     * @param array<int, string> $codes
     * @return array<int, int>
     */
    public function findVectorIndexIds(
        array $categoryIds = [],
        array $codes = [],
        ?string $publisherType = null,
        string $afterId = '0',
        int $limit = 100,
    ): array;

    /**
     * 增加市场技能的安装次数.
     *
     * @param int $id 市场技能 ID
     * @return bool 是否更新成功
     */
    public function incrementInstallCount(int $id): bool;

    public function updateBaseInstallCountById(int $id, int $baseInstallCount): bool;

    /**
     * 更新市场技能排序值.
     *
     * @param int $id 市场技能 ID
     * @param int $sortOrder 排序值
     * @return bool 是否更新成功
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool;

    /**
     * 按传入字段部分更新市场技能信息.
     *
     * @param array{
     *     sort_order?: null|int,
     *     is_featured?: bool,
     *     is_hidden?: bool
     * } $payload
     * @return bool 是否更新成功
     */
    public function updateInfoById(int $id, array $payload): bool;
}
