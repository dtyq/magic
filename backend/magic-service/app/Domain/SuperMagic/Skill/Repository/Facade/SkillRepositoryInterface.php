<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Facade;

use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * Skill 仓储接口.
 */
interface SkillRepositoryInterface
{
    public function lockByCode(SkillDataIsolation $dataIsolation, string $code): void;

    /** @return SkillEntity[] */
    public function findByProjectId(SkillDataIsolation $dataIsolation, int $projectId): array;

    /**
     * 根据 code 查找 Skill.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     */
    public function findByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillEntity;

    /**
     * 根据 code 列表批量查询技能.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $codes Skill code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 code
     */
    public function findByCodes(SkillDataIsolation $dataIsolation, array $codes): array;

    /**
     * 查询当前用户创建的技能 code。
     *
     * @return array<string>
     */
    public function findCodesByCreator(SkillDataIsolation $dataIsolation): array;

    /**
     * 保存 Skill.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $entity Skill 实体
     */
    public function save(SkillDataIsolation $dataIsolation, SkillEntity $entity): SkillEntity;

    /**
     * 根据 package_name 和 creator_id 查找用户已存在的技能（非store来源）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findByPackageNameAndCreator(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity;

    /**
     * 根据 package_name 查找用户组织下已存在的技能（所有来源类型）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findByPackageName(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity;

    /**
     * 查询用户技能列表（支持分页、关键词搜索、来源类型筛选）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{total: int, list: SkillEntity[]} 总数和技能实体数组
     */
    public function queries(
        SkillDataIsolation $dataIsolation,
        SkillQuery $query,
        Page $page
    ): array;

    /**
     * Query skills by visible skill codes.
     *
     * @param array<string> $codes Visible skill code list
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queriesByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array;

    /**
     * Query shared skills by visible skill codes.
     *
     * @param array<string> $codes Visible skill code list
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queriesSharedByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array;

    /**
     * 查询用户技能总数（用于分页）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $keyword 关键词（搜索 name_i18n 和 description_i18n）
     * @param string $languageCode 语言代码（如 en_US, zh_CN）
     * @param string $sourceType 来源类型筛选（LOCAL_UPLOAD, STORE, GITHUB）
     * @return int 总记录数
     */
    public function countList(
        SkillDataIsolation $dataIsolation,
        string $keyword,
        string $languageCode,
        string $sourceType
    ): int;

    /**
     * 根据 code 删除 Skill（软删除）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return bool 是否删除成功
     */
    public function deleteByCode(SkillDataIsolation $dataIsolation, string $code): bool;

    /**
     * 根据市场 skill_code 列表查询用户已添加的技能（用于判断 is_added 和 need_upgrade）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $versionCodes 市场 skill_code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 skill_code
     */
    public function findByVersionCodes(SkillDataIsolation $dataIsolation, array $versionCodes): array;

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $skillIds Skill ID 列表
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findByIds(SkillDataIsolation $dataIsolation, array $skillIds): array;

    /**
     * 根据 project_id 更新 Skill 的 updated_at 时间.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $projectId 项目ID
     * @return bool 是否更新成功
     */
    public function updateUpdatedAtByProjectId(SkillDataIsolation $dataIsolation, int $projectId): bool;

    public function findUserSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array;

    /**
     * 查询本地 ZIP 导入的 Skill，用于一次性清理历史多语言数据.
     *
     * @return array{total: int, list: SkillEntity[]}
     */
    public function findLocalUploadSkillsForI18nCleanup(
        SkillDataIsolation $dataIsolation,
        ?string $skillCode,
        int $page,
        int $pageSize
    ): array;

    /**
     * 仅更新 Skill 的名称和描述多语言字段.
     */
    public function updateNameAndDescriptionI18n(
        SkillDataIsolation $dataIsolation,
        string $skillCode,
        array $nameI18n,
        ?array $descriptionI18n
    ): bool;
}
