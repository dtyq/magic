<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Hyperf\DbConnection\Db;
use Throwable;
use ValueError;

/**
 * Skill 领域服务.
 */
class SkillDomainService
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillVersionRepositoryInterface $skillVersionRepository,
        protected SkillMarketDomainService $skillMarketDomainService
    ) {
    }

    /**
     * 根据 code 查找用户技能并验证权限.
     * 验证技能是否属于当前用户组织且属于当前用户（通过 creator_id）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillEntity 技能实体
     */
    public function findUserSkillByCode(SkillDataIsolation $dataIsolation, string $code): SkillEntity
    {
        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $code);

        // 验证技能是否属于当前用户
        if ($skillEntity && $skillEntity->getCreatorId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_ACCESS_DENIED, 'skill.skill_access_denied');
        }
        if (! $skillEntity) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        return $skillEntity;
    }

    /**
     * 根据 code 列表批量查询技能.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $codes Skill code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 code
     */
    public function findSkillsByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        return $this->skillRepository->findByCodes($dataIsolation, $codes);
    }

    /**
     * 根据 code 列表批量查询用户技能.
     * 验证技能是否属于当前用户（通过 creator_id）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $codes Skill code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 code
     */
    public function findUserSkillsByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        $skillEntities = $this->skillRepository->findByCodes($dataIsolation, $codes);

        // 验证技能是否属于当前用户
        $result = [];
        foreach ($skillEntities as $code => $skillEntity) {
            if ($skillEntity->getCreatorId() !== $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_ACCESS_DENIED, 'skill.skill_access_denied');
            }
            $result[$code] = $skillEntity;
        }

        return $result;
    }

    /**
     * 保存 Skill.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $entity Skill 实体
     */
    public function saveSkill(SkillDataIsolation $dataIsolation, SkillEntity $entity): SkillEntity
    {
        return $this->skillRepository->save($dataIsolation, $entity);
    }

    /**
     * 根据 ID 查找 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $id 版本 ID
     */
    public function findSkillVersionById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findById($dataIsolation, $id);
    }

    /**
     * 根据 ID 查找 Skill 版本（不进行组织过滤，用于查询公开的商店技能版本）.
     *
     * @param int $id 版本 ID
     */
    public function findSkillVersionByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findByIdWithoutOrganizationFilter($id);
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $skillIds Skill ID 列表
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        return $this->skillRepository->findByIds($dataIsolation, $skillIds);
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $skillIds Skill ID 列表
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findUserSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        return $this->skillRepository->findUserSkillsByIds($dataIsolation, $skillIds);
    }

    /**
     * 保存 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillVersionEntity $entity Skill 版本实体
     */
    public function saveSkillVersion(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity
    {
        return $this->skillVersionRepository->save($dataIsolation, $entity);
    }

    /**
     * 根据 package_name 和 creator_id 查找用户已存在的技能（非store来源）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findSkillByPackageNameAndCreator(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        return $this->skillRepository->findByPackageNameAndCreator($dataIsolation, $packageName);
    }

    /**
     * 根据 package_name 查找用户组织下已存在的技能（所有来源类型）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findSkillByPackageName(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        return $this->skillRepository->findByPackageName($dataIsolation, $packageName);
    }

    /**
     * 根据 version_code 列表查询用户已添加的技能（用于判断 is_added 和 need_upgrade）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $versionCodes version_code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 version_code
     */
    public function findByVersionCodes(SkillDataIsolation $dataIsolation, array $versionCodes): array
    {
        return $this->skillRepository->findByVersionCodes($dataIsolation, $versionCodes);
    }

    /**
     * 检查用户组织是否已添加该技能（通过 code 判断）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return bool 是否已添加
     */
    public function isSkillAdded(SkillDataIsolation $dataIsolation, string $code): bool
    {
        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $code);
        return $skillEntity !== null;
    }

    /**
     * 升级来自市场的技能到最新版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillEntity 更新后的技能实体
     */
    public function upgradeMarketSkill(SkillDataIsolation $dataIsolation, string $code): SkillEntity
    {
        // 1. 查询技能记录（校验权限和来源类型）
        $skillEntity = $this->findUserSkillByCode($dataIsolation, $code);

        // 2. 检查来源类型：仅允许升级市场来源的技能
        if (! $skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::NON_STORE_SKILL_CANNOT_UPGRADE, 'skill.non_store_skill_cannot_upgrade');
        }

        // 3. 查询市场中该技能的已发布版本（使用 version_code 匹配 skill_code）
        $versionCode = $skillEntity->getVersionCode();
        if (! $versionCode) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_NOT_FOUND, 'skill.store_skill_not_found');
        }

        $marketSkill = $this->skillMarketDomainService->findStoreSkillBySkillCode($versionCode);
        if (! $marketSkill || ! $marketSkill->getPublishStatus()->isPublished()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_NOT_FOUND, 'skill.store_skill_not_found');
        }

        // 4. 查询市场版本对应的 Skill 版本详情（获取 package_name、file_key 等）
        $skillVersion = $this->findSkillVersionByIdWithoutOrganizationFilter($marketSkill->getSkillVersionId());
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        // 5. 判断是否需要升级：比较用户当前的 version_id 和 version_code 与市场的 skill_version_id 和 version
        $currentVersionId = $skillEntity->getVersionId();
        $currentVersionCode = $skillEntity->getVersionCode();
        $marketVersionId = $marketSkill->getSkillVersionId();
        $marketVersionCode = $skillVersion->getVersion();

        if ($currentVersionId === $marketVersionId && $currentVersionCode === $marketVersionCode) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_ALREADY_LATEST_VERSION, 'skill.skill_already_latest_version');
        }

        // 6. 执行升级操作
        return $this->applyMarketSkillUpgrade($dataIsolation, $skillEntity, $marketSkill, $skillVersion);
    }

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
    ): array {
        return $this->skillRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 查询用户技能总数（用于分页）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $keyword 关键词（搜索 name_i18n 和 description_i18n）
     * @param string $languageCode 语言代码（如 en_US, zh_CN）
     * @param string $sourceType 来源类型筛选（LOCAL_UPLOAD, STORE, GITHUB）
     * @return int 总记录数
     */
    public function countSkillList(
        SkillDataIsolation $dataIsolation,
        string $keyword,
        string $languageCode,
        string $sourceType
    ): int {
        return $this->skillRepository->countList($dataIsolation, $keyword, $languageCode, $sourceType);
    }

    /**
     * 删除 Skill（软删除）.
     * 删除前会将所有版本和市场技能标记为已下架.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return bool 是否删除成功
     */
    public function deleteSkill(SkillDataIsolation $dataIsolation, string $code): bool
    {
        // 使用事务处理删除逻辑
        Db::beginTransaction();
        try {
            // 1. 查询该技能的所有版本（不限制状态）
            $allVersions = $this->findAllSkillVersionsByCode($dataIsolation, $code);

            // 2. 将所有版本的状态改为 OFFLINE（如果当前不是 OFFLINE）
            foreach ($allVersions as $version) {
                if (! $version->getPublishStatus()->isOffline()) {
                    $version->setPublishStatus(PublishStatus::OFFLINE);
                    $this->saveSkillVersion($dataIsolation, $version);
                }
            }

            // 3. 更新市场技能表中对应记录的发布状态为 OFFLINE（不限制当前状态）
            $this->skillMarketDomainService->updateAllPublishStatusBySkillCode($code, PublishStatus::OFFLINE->value);

            // 4. 执行软删除
            $result = $this->skillRepository->deleteByCode($dataIsolation, $code);

            Db::commit();
            return $result;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 更新技能基本信息.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $skillEntity Skill 实体
     * @param null|array $nameI18n 多语言名称（可选）
     * @param null|array $descriptionI18n 多语言描述（可选）
     * @param null|string $logo Logo URL（可选，空字符串表示清空）
     * @return SkillEntity 更新后的 Skill 实体
     */
    public function updateSkillInfo(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?string $logo = null
    ): SkillEntity {
        if ($nameI18n !== null) {
            $skillEntity->setNameI18n($nameI18n);
        }
        if ($descriptionI18n !== null) {
            $skillEntity->setDescriptionI18n($descriptionI18n);
        }
        if ($logo !== null) {
            $skillEntity->setLogo($logo === '' ? null : $logo);
        }

        return $this->skillRepository->save($dataIsolation, $skillEntity);
    }

    /**
     * 更新技能版本基本信息.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillVersionEntity $versionEntity Skill 版本实体
     * @param null|array $nameI18n 多语言名称（可选）
     * @param null|array $descriptionI18n 多语言描述（可选）
     * @param null|string $logo Logo URL（可选，空字符串表示清空）
     * @return SkillVersionEntity 更新后的 Skill 版本实体
     */
    public function updateSkillVersionInfo(
        SkillDataIsolation $dataIsolation,
        SkillVersionEntity $versionEntity,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?string $logo = null
    ): SkillVersionEntity {
        if ($nameI18n !== null) {
            $versionEntity->setNameI18n($nameI18n);
        }
        if ($descriptionI18n !== null) {
            $versionEntity->setDescriptionI18n($descriptionI18n);
        }
        if ($logo !== null) {
            $versionEntity->setLogo($logo === '' ? null : $logo);
        }

        return $this->skillVersionRepository->save($dataIsolation, $versionEntity);
    }

    /**
     * 根据 code 查找最新版本的 Skill 版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findLatestSkillVersionByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findLatestByCode($dataIsolation, $code);
    }

    /**
     * 根据 code 查找最新已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return null|SkillVersionEntity 不存在返回 null
     */
    public function findLatestPublishedSkillVersionByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findLatestPublishedByCode($dataIsolation, $code);
    }

    /**
     * 查找待审核的技能版本.
     */
    public function findPendingReviewSkillVersionById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findPendingReviewById($dataIsolation, $id);
    }

    /**
     * 根据 code 查找所有已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillVersionEntity[] 已发布的版本列表
     */
    public function findAllPublishedSkillVersionsByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        return $this->skillVersionRepository->findAllPublishedByCode($dataIsolation, $code);
    }

    /**
     * 根据 code 查找所有版本的 Skill 版本（不限制状态）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillVersionEntity[] 所有版本列表
     */
    public function findAllSkillVersionsByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        return $this->skillVersionRepository->findAllByCode($dataIsolation, $code);
    }

    /**
     * 发布技能到商店（创建待审核版本）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillVersionEntity 创建的版本实体
     */
    public function publishSkill(SkillDataIsolation $dataIsolation, string $code): SkillVersionEntity
    {
        // 1. 查询技能基础信息（校验权限和来源类型）
        $skillEntity = $this->findUserSkillByCode($dataIsolation, $code);

        // 2. 校验来源类型：仅允许发布非市场来源的技能
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_PUBLISH, 'skill.store_skill_cannot_publish');
        }

        // 3. 处理 Logo：如果 logo 是完整 URL，提取路径部分
        $logoPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');

        // 4. 使用事务处理发布逻辑
        Db::beginTransaction();
        try {
            // 5. 查询该技能的最新版本号（用于版本号递增）
            $latestVersion = $this->findLatestSkillVersionByCode($dataIsolation, $skillEntity->getCode());

            // 6. 自动递增版本号
            $newVersion = '1';
            if ($latestVersion) {
                $currentVersion = (int) $latestVersion->getVersion();
                $newVersion = (string) ($currentVersion + 1);
            }

            // 7. 创建 Skill 版本记录（待发布、审核中状态）
            $versionEntity = new SkillVersionEntity();
            $versionEntity->setCode($skillEntity->getCode());
            $versionEntity->setOrganizationCode($skillEntity->getOrganizationCode());
            $versionEntity->setCreatorId($skillEntity->getCreatorId());
            $versionEntity->setPackageName($skillEntity->getPackageName());
            $versionEntity->setPackageDescription($skillEntity->getPackageDescription());
            $versionEntity->setVersion($newVersion);
            $versionEntity->setNameI18n($skillEntity->getNameI18n());
            $versionEntity->setDescriptionI18n($skillEntity->getDescriptionI18n());
            $versionEntity->setLogo($logoPath ?: null);
            $versionEntity->setFileKey($skillEntity->getFileKey());
            $versionEntity->setSourceType($skillEntity->getSourceType());
            $versionEntity->setProjectId($skillEntity->getProjectId());
            $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::UNDER_REVIEW);

            $versionEntity = $this->saveSkillVersion($dataIsolation, $versionEntity);

            Db::commit();
            return $versionEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 下架技能版本（下架所有已发布的版本，并更新商店表）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     */
    public function offlineSkill(SkillDataIsolation $dataIsolation, string $code): void
    {
        // 1. 查询技能基础信息（校验权限）
        $this->findUserSkillByCode($dataIsolation, $code);

        // 2. 使用事务处理下架逻辑
        Db::beginTransaction();
        try {
            // 3. 查询该技能的所有已发布版本（publish_status = PUBLISHED 且 review_status = APPROVED）
            $publishedVersions = $this->findAllPublishedSkillVersionsByCode($dataIsolation, $code);
            if (empty($publishedVersions)) {
                ExceptionBuilder::throw(SkillErrorCode::NO_PUBLISHED_VERSION, 'skill.no_published_version');
            }

            // 4. 更新所有已发布版本的发布状态为 OFFLINE
            foreach ($publishedVersions as $publishedVersion) {
                $publishedVersion->setPublishStatus(PublishStatus::OFFLINE);
                $this->saveSkillVersion($dataIsolation, $publishedVersion);
            }

            // 5. 更新商店表中对应记录的发布状态为 OFFLINE（如果存在）
            $this->skillMarketDomainService->updateAllPublishStatusBySkillCode($code, PublishStatus::OFFLINE->value);

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 审核技能版本（包含完整的验证和审核逻辑）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $id 技能版本 ID
     * @param string $action 审核操作：APPROVED=通过, REJECTED=拒绝
     * @param string $publisherType 发布者类型（审核通过时使用）：USER=普通用户, OFFICIAL=官方运营, VERIFIED_CREATOR=认证创作者, PARTNER=第三方机构
     */
    public function reviewSkillVersion(SkillDataIsolation $dataIsolation, int $id, string $action, string $publisherType = ''): void
    {
        // 1. 查找待审核的技能版本
        $skillVersion = $this->findPendingReviewSkillVersionById($dataIsolation, $id);
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        // 2. 验证版本状态：必须是未发布状态且审核中状态
        if (! $skillVersion->getPublishStatus()->isUnpublished()
            || ! $skillVersion->getReviewStatus()?->isUnderReview()) {
            ExceptionBuilder::throw(SkillErrorCode::CANNOT_REVIEW_VERSION, 'skill.cannot_review_version');
        }

        // 3. 解析审核操作
        try {
            $reviewStatus = ReviewStatus::from($action);
        } catch (ValueError $e) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_REVIEW_ACTION, 'skill.invalid_review_action');
        }

        // 4. 根据审核操作执行相应的处理
        if ($reviewStatus === ReviewStatus::APPROVED) {
            // 处理 publisher_type
            if (empty($publisherType)) {
                $publisherType = PublisherType::USER->value;
            }
            $publisherTypeEnum = PublisherType::from($publisherType);

            // 调用审核通过方法
            $this->approveSkillVersion($dataIsolation, $skillVersion, $publisherTypeEnum);
        } else {
            // 调用审核拒绝方法
            $this->rejectSkillVersion($dataIsolation, $skillVersion);
        }
    }

    /**
     * 从技能市场添加技能.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $storeSkillId 市场技能 ID
     * @return SkillEntity 创建的技能实体
     */
    public function addSkillFromMarket(SkillDataIsolation $dataIsolation, int $storeSkillId): SkillEntity
    {
        // 1. 查询商店技能信息（仅查询已发布的）
        $storeSkill = $this->skillMarketDomainService->findPublishedById($storeSkillId);
        if (! $storeSkill) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_NOT_FOUND, 'skill.store_skill_not_found');
        }

        // 2. 查询技能版本信息（获取完整信息，不进行组织过滤，因为商店技能是公开的）
        $skillVersion = $this->findSkillVersionByIdWithoutOrganizationFilter($storeSkill->getSkillVersionId());
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        // 3. 检查用户组织是否已添加该技能（通过 version_code 判断）
        $versionCode = $skillVersion->getVersion();
        $userSkillsMap = $this->findByVersionCodes($dataIsolation, [$versionCode]);
        if (isset($userSkillsMap[$versionCode])) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_ALREADY_ADDED, 'skill.store_skill_already_added');
        }

        // 4. 创建技能记录
        $skillEntity = new SkillEntity([
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'code' => IdGenerator::getUniqueId32(),
            'creator_id' => $dataIsolation->getCurrentUserId(),
            'package_name' => $skillVersion->getPackageName(),
            'package_description' => $skillVersion->getPackageDescription(),
            'name_i18n' => $storeSkill->getNameI18n() ?? [],
            'description_i18n' => $storeSkill->getDescriptionI18n() ?? [],
            'logo' => $storeSkill->getLogo() ?? '',
            'file_key' => $skillVersion->getFileKey(),
            'source_type' => SkillSourceType::MARKET->value,
            'source_id' => $storeSkill->getId(),
            'source_meta' => [
                'store_skill_id' => $storeSkill->getId(),
                'skill_version_id' => $storeSkill->getSkillVersionId(),
                'version_code' => $storeSkill->getSkillCode(),
            ],
            'version_id' => $storeSkill->getSkillVersionId(),
            'version_code' => $storeSkill->getSkillCode(),
            'is_enabled' => true,
        ]);

        // 使用事务确保数据一致性
        Db::beginTransaction();
        try {
            // 保存技能记录
            $skillEntity = $this->saveSkill($dataIsolation, $skillEntity);

            // 更新商店技能的安装次数
            $this->skillMarketDomainService->incrementInstallCount($storeSkill->getId());

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        return $skillEntity;
    }

    /**
     * 应用市场技能的升级（更新技能实体到指定版本）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $skillEntity 技能实体
     * @param SkillMarketEntity $marketSkill 市场技能实体
     * @param SkillVersionEntity $skillVersion 技能版本实体
     * @return SkillEntity 更新后的技能实体
     */
    private function applyMarketSkillUpgrade(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillMarketEntity $marketSkill,
        SkillVersionEntity $skillVersion
    ): SkillEntity {
        // 更新 name_i18n、description_i18n、logo（来自市场技能信息）
        $skillEntity->setNameI18n($marketSkill->getNameI18n() ?? []);
        $skillEntity->setDescriptionI18n($marketSkill->getDescriptionI18n() ?? []);

        // 处理 logo（提取路径部分）
        $logo = $marketSkill->getLogo() ?? '';
        $logoPath = ! empty($logo) ? EasyFileTools::formatPath($logo) : null;
        $skillEntity->setLogo($logoPath);

        // 更新 package_name、package_description、file_key（来自版本信息）
        $skillEntity->setPackageName($skillVersion->getPackageName());
        $skillEntity->setPackageDescription($skillVersion->getPackageDescription());
        $skillEntity->setFileKey($skillVersion->getFileKey());

        // 更新 version_id 和 version_code
        $skillEntity->setVersionId($marketSkill->getSkillVersionId());
        $skillEntity->setVersionCode($skillVersion->getVersion());

        // 更新 source_meta 中的 skill_version_id
        $sourceMeta = $skillEntity->getSourceMeta() ?? [];
        $sourceMeta['skill_version_id'] = $marketSkill->getSkillVersionId();
        // 保持 store_skill_id（如果存在）
        if (! isset($sourceMeta['store_skill_id'])) {
            $sourceMeta['store_skill_id'] = $marketSkill->getId();
        }
        $skillEntity->setSourceMeta($sourceMeta);

        return $this->skillRepository->save($dataIsolation, $skillEntity);
    }

    /**
     * 审核通过技能版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillVersionEntity $skillVersion 技能版本实体
     * @param PublisherType $publisherType 发布者类型
     */
    private function approveSkillVersion(SkillDataIsolation $dataIsolation, SkillVersionEntity $skillVersion, PublisherType $publisherType): void
    {
        // 1. 更新技能版本状态为已发布和审核通过
        $skillVersion->setReviewStatus(ReviewStatus::APPROVED);
        $skillVersion->setPublishStatus(PublishStatus::PUBLISHED);
        $this->saveSkillVersion($dataIsolation, $skillVersion);

        // 2. 检查商店表中是否已存在该 skill_code 的记录
        $storeSkill = $this->skillMarketDomainService->findStoreSkillBySkillCode($skillVersion->getCode());

        if ($storeSkill) {
            // 更新现有记录
            $storeSkill->setOrganizationCode($skillVersion->getOrganizationCode());
            $storeSkill->setSkillVersionId($skillVersion->getId());
            $storeSkill->setNameI18n($skillVersion->getNameI18n());
            $storeSkill->setDescriptionI18n($skillVersion->getDescriptionI18n());
            $storeSkill->setLogo($skillVersion->getLogo());
            $storeSkill->setPublisherType($publisherType);
            $storeSkill->setPublishStatus(PublishStatus::PUBLISHED);
            $this->skillMarketDomainService->saveStoreSkill($storeSkill);
        } else {
            // 创建新记录
            $newStoreSkill = new SkillMarketEntity([
                'organization_code' => $skillVersion->getOrganizationCode(),
                'skill_code' => $skillVersion->getCode(),
                'skill_version_id' => $skillVersion->getId(),
                'name_i18n' => $skillVersion->getNameI18n(),
                'description_i18n' => $skillVersion->getDescriptionI18n(),
                'logo' => $skillVersion->getLogo(),
                'publisher_id' => $skillVersion->getCreatorId(),
                'publisher_type' => $publisherType->value,
                'category_id' => null,
                'publish_status' => PublishStatus::PUBLISHED->value,
                'install_count' => 0,
            ]);
            $this->skillMarketDomainService->saveStoreSkill($newStoreSkill);
        }
    }

    /**
     * 审核拒绝技能版本.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillVersionEntity $skillVersion 技能版本实体
     */
    private function rejectSkillVersion(SkillDataIsolation $dataIsolation, SkillVersionEntity $skillVersion): void
    {
        // 设置审核状态为拒绝，发布状态保持为未发布
        $skillVersion->setReviewStatus(ReviewStatus::REJECTED);
        $this->saveSkillVersion($dataIsolation, $skillVersion);
    }
}
