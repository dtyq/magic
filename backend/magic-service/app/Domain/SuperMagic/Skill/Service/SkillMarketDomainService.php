<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Service;

use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 市场 Skill 领域服务.
 */
class SkillMarketDomainService
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillMarketRepositoryInterface $skillMarketRepository,
        protected SkillCategoryRepositoryInterface $skillCategoryRepository,
        protected SkillVersionRepositoryInterface $skillVersionRepository
    ) {
    }

    /**
     * 获取已发布的官方内置 Skill code。
     *
     * @return array<string>
     */
    public function getOfficialBuiltinSkillCodes(): array
    {
        return array_values(array_map(
            static fn (SkillMarketEntity $entity): string => $entity->getSkillCode(),
            $this->getOfficialBuiltinSkillEntities()
        ));
    }

    /**
     * 获取市场在架（已发布且未隐藏）的 Skill code.
     *
     * @param array<string> $skillCodes
     * @return array<string>
     */
    public function getPublishedSkillCodes(array $skillCodes): array
    {
        return $this->skillMarketRepository->findPublishedSkillCodes($skillCodes);
    }

    /**
     * 获取已发布的官方内置 Skill 实体。
     *
     * @return array<int, SkillMarketEntity>
     */
    public function getOfficialBuiltinSkillEntities(): array
    {
        return $this->skillMarketRepository->getOfficialBuiltinSkillEntities();
    }

    /**
     * 批量查询商店技能的最新版本信息（用于判断 need_upgrade）.
     *
     * @param array $skillCodes Skill code 列表（对应 magic_skills.version_code）
     * @return SkillMarketEntity[] 市场技能实体数组，key 为 skill_code
     */
    public function findLatestPublishedBySkillCodes(array $skillCodes): array
    {
        return $this->skillMarketRepository->findLatestPublishedBySkillCodes($skillCodes);
    }

    /**
     * 根据 skill_code 更新所有商店技能的发布状态（不限制当前状态）.
     *
     * @param string $skillCode Skill code
     * @param string $publishStatus 发布状态
     * @return bool 是否更新成功
     */
    public function updateAllPublishStatusBySkillCode(string $skillCode, string $publishStatus): bool
    {
        return $this->skillMarketRepository->updateAllPublishStatusBySkillCode($skillCode, $publishStatus);
    }

    /**
     * 根据 skill_code 查找商店技能.
     */
    public function findStoreSkillBySkillCode(string $skillCode): ?SkillMarketEntity
    {
        return $this->skillMarketRepository->findBySkillCode($skillCode);
    }

    public function findOfficialSkillBySkillCode(string $organizationCode, string $skillCode): ?SkillMarketEntity
    {
        return $this->skillMarketRepository->findOfficialBySkillCode($organizationCode, $skillCode);
    }

    public function findOfficialSkillByPackageName(string $packageName): ?SkillMarketEntity
    {
        return $this->skillMarketRepository->findOfficialByPackageName($packageName);
    }

    /**
     * Find the latest published market skill by skill code.
     */
    public function findPublishedBySkillCode(string $skillCode): ?SkillMarketEntity
    {
        return $this->skillMarketRepository->findPublishedBySkillCode($skillCode);
    }

    /**
     * 保存市场技能.
     */
    public function saveStoreSkill(SkillMarketEntity $entity): SkillMarketEntity
    {
        return $this->skillMarketRepository->save($entity);
    }

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
    ): array {
        if ($query->getCategoryIds() !== null && $query->getCategoryIds() !== []) {
            $query->setCategoryIds($this->skillCategoryRepository->findSelfAndDescendantIds($query->getCategoryIds()));
        }
        return $this->skillMarketRepository->queries($query, $page);
    }

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
    ): array {
        if ($categoryIds !== []) {
            $categoryIds = $this->skillCategoryRepository->findSelfAndDescendantIds($categoryIds);
        }
        return $this->skillMarketRepository->queryAdminMarkets(
            $publishStatus,
            $organizationCode,
            $name18n,
            $publisherType,
            $skillCode,
            $packageName,
            $startTime,
            $endTime,
            $categoryIds,
            $orderBy,
            $page
        );
    }

    /**
     * 根据 ID 查找商店技能（仅查询已发布的）.
     *
     * @param int $id 商店技能 ID
     * @return null|SkillMarketEntity 不存在返回 null
     */
    public function findPublishedById(int $id): ?SkillMarketEntity
    {
        return $this->skillMarketRepository->findPublishedById($id);
    }

    /**
     * 下架市场 Skill.
     */
    public function offlineById(SkillDataIsolation $dataIsolation, int $id): ?SkillMarketEntity
    {
        $marketSkill = $this->skillMarketRepository->findById($id);
        if ($marketSkill === null) {
            return null;
        }

        if (! $marketSkill->getPublishStatus()->isOffline()) {
            $marketSkill->offline();
            $this->skillMarketRepository->save($marketSkill);
        }

        $this->skillVersionRepository->offlinePublishedVersionsByCode($dataIsolation, $marketSkill->getSkillCode());

        return $marketSkill;
    }

    /**
     * Batch query market skills by IDs.
     *
     * @return array<int, SkillMarketEntity>
     */
    public function findByIds(array $ids): array
    {
        return $this->skillMarketRepository->findByIds($ids);
    }

    /** @param array<int, int|string> $ids @return array<int, SkillMarketEntity> */
    public function findVisibleByIds(array $ids): array
    {
        return $this->skillMarketRepository->findVisibleByIds($ids);
    }

    /** Query published market skills missing SKILL.md by an ID cursor. */
    public function findPublishedWithoutSkillFileByIdCursor(int $afterId = 0, int $limit = 100): array
    {
        return $this->skillMarketRepository->findPublishedWithoutSkillFileByIdCursor($afterId, $limit);
    }

    /**
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
    ): array {
        if ($categoryIds !== []) {
            $categoryIds = $this->skillCategoryRepository->findSelfAndDescendantIds($categoryIds);
        }

        return $this->skillMarketRepository->findVectorIndexIds($categoryIds, $codes, $publisherType, $afterId, $limit);
    }

    /**
     * 增加商店技能的安装次数.
     *
     * @param int $id 商店技能 ID
     * @return bool 是否更新成功
     */
    public function incrementInstallCount(int $id): bool
    {
        return $this->skillMarketRepository->incrementInstallCount($id);
    }

    /**
     * 更新市场 Skill 排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        return $this->skillMarketRepository->updateSortOrderById($id, $sortOrder);
    }

    /**
     * 按传入字段部分更新市场 Skill 信息.
     *
     * @param array{sort_order?: null|int, is_featured?: bool, is_hidden?: bool} $payload
     */
    public function updateInfoById(int $id, array $payload): bool
    {
        return $this->skillMarketRepository->updateInfoById($id, $payload);
    }
}
