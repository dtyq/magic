<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Facade;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;

/**
 * Skill 版本仓储接口.
 */
interface SkillVersionRepositoryInterface
{
    /**
     * 根据 ID 查找 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $id 版本 ID
     */
    public function findById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity;

    /**
     * 保存 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillVersionEntity $entity Skill 版本实体
     */
    public function save(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity;

    /**
     * 根据 code 查找最新版本的 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findLatestByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity;

    /**
     * 根据 code 查找最新已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findLatestPublishedByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity;

    /**
     * 根据 ID 查找待审核的技能版本（publish_status = UNPUBLISHED）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $id 版本 ID
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findPendingReviewById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity;

    /**
     * 根据 code 查找所有已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillVersionEntity[] 已发布的版本列表
     */
    public function findAllPublishedByCode(SkillDataIsolation $dataIsolation, string $code): array;

    /**
     * 根据 code 查找所有版本的 Skill 版本（不限制状态）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillVersionEntity[] 所有版本列表
     */
    public function findAllByCode(SkillDataIsolation $dataIsolation, string $code): array;

    /**
     * 根据 ID 查找 Skill 版本（不进行组织过滤，用于查询公开的商店技能版本）.
     *
     * @param int $id 版本 ID
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity;
}
