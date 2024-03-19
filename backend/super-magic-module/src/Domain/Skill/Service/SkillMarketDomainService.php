<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;

/**
 * 市场 Skill 领域服务.
 */
class SkillMarketDomainService
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillMarketRepositoryInterface $skillMarketRepository,
        protected SkillCategoryRepositoryInterface $skillCategoryRepository
    ) {
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
     * @return array{total: int, list: SkillMarketEntity[]} 总数和市场技能实体数组
     */
    public function queries(
        SkillQuery $query,
        Page $page
    ): array {
        return $this->skillMarketRepository->queries($query, $page);
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
     * 增加商店技能的安装次数.
     *
     * @param int $id 商店技能 ID
     * @return bool 是否更新成功
     */
    public function incrementInstallCount(int $id): bool
    {
        return $this->skillMarketRepository->incrementInstallCount($id);
    }
}
