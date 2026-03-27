<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;

/**
 * 市场 Skill 仓储接口.
 */
interface SkillMarketRepositoryInterface
{
    /**
     * 批量查询市场技能的最新版本信息（用于判断 need_upgrade）.
     *
     * @param array $skillCodes Skill code 列表（对应 magic_skills.version_code）
     * @return SkillMarketEntity[] 市场技能实体数组，key 为 skill_code
     */
    public function findLatestPublishedBySkillCodes(array $skillCodes): array;

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
     * @return array{total: int, list: SkillMarketEntity[]} 总数和市场技能实体数组
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
     * 增加市场技能的安装次数.
     *
     * @param int $id 市场技能 ID
     * @return bool 是否更新成功
     */
    public function incrementInstallCount(int $id): bool;

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
     *     category_id?: null|int,
     *     sort_order?: null|int,
     *     is_featured?: bool
     * } $payload
     * @return bool 是否更新成功
     */
    public function updateInfoById(int $id, array $payload): bool;
}
