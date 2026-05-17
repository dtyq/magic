<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Service;

use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillVersionAdminQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\UserSkillRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Hyperf\DbConnection\Db;
use Throwable;
use ValueError;

/**
 * Skill 版本领域服务.
 */
class SkillVersionDomainService
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillVersionRepositoryInterface $skillVersionRepository,
        protected UserSkillRepositoryInterface $userSkillRepository,
        protected SkillMarketDomainService $skillMarketDomainService,
    ) {
    }

    public function findSkillVersionById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findById($dataIsolation, $id);
    }

    /**
     * @param array<string> $codes
     * @return array<string, SkillVersionEntity>
     */
    public function findSkillCurrentOrLatestByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        return $this->skillVersionRepository->findCurrentOrLatestByCodes($dataIsolation, $codes);
    }

    /**
     * @param array<string> $codes
     * @return array<string, SkillVersionEntity>
     */
    public function findCurrentSkillVersionsByCodesWithoutOrganizationFilter(array $codes): array
    {
        return $this->skillVersionRepository->findCurrentByCodesWithoutOrganizationFilter($codes);
    }

    /**
     * @param array<string> $codes
     * @return array<string, SkillVersionEntity>
     */
    public function findCurrentPublishedVersionsByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        return $this->skillVersionRepository->findCurrentPublishedByCodes($dataIsolation, $codes);
    }

    /**
     * @param array<string> $codes
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queryCurrentPublishedVersionsByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        ?string $keyword,
        Page $page
    ): array {
        return $this->skillVersionRepository->queriesCurrentPublishedByCodes(
            $dataIsolation,
            $codes,
            $keyword,
            $page
        );
    }

    public function findSkillVersionByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findByIdWithoutOrganizationFilter($id);
    }

    /**
     * @param array<int> $ids
     * @return array<int, SkillVersionEntity>
     */
    public function findSkillVersionsByIdsWithoutOrganizationFilter(array $ids): array
    {
        return $this->skillVersionRepository->findByIdsWithoutOrganizationFilter($ids);
    }

    public function saveSkillVersion(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity
    {
        $entity->setSearchText(SkillMarketSearchTextBuilder::buildFromSkillVersion($entity));
        return $this->skillVersionRepository->save($dataIsolation, $entity);
    }

    /**
     * 用当前安装版本或当前已发布版本，替换协作可见 Skill 的展示字段。
     *
     * @param SkillEntity[] $skillEntities
     * @return SkillEntity[]
     */
    public function replaceVisibleSkillDisplayFields(SkillDataIsolation $dataIsolation, array $skillEntities): array
    {
        if ($skillEntities === []) {
            return [];
        }

        $skillCodesToReplace = [];
        foreach ($skillEntities as $skillEntity) {
            if ($skillEntity->getCreatorId() !== $dataIsolation->getCurrentUserId()) {
                $skillCodesToReplace[] = $skillEntity->getCode();
            }
        }

        if ($skillCodesToReplace === []) {
            return $skillEntities;
        }

        $skillCodesToReplace = array_values(array_unique($skillCodesToReplace));
        $publishedVersionMap = $this->findCurrentPublishedVersionsByCodes($dataIsolation, $skillCodesToReplace);
        $userSkillMap = $this->userSkillRepository->findBySkillCodes($dataIsolation, $skillCodesToReplace);

        $versionIds = [];
        foreach ($userSkillMap as $userSkillEntity) {
            if ($userSkillEntity->getSkillVersionId() !== null) {
                $versionIds[] = $userSkillEntity->getSkillVersionId();
            }
        }

        $versionMap = $versionIds === []
            ? []
            : $this->findSkillVersionsByIdsWithoutOrganizationFilter(array_values(array_unique($versionIds)));

        foreach ($skillEntities as $index => $skillEntity) {
            if ($skillEntity->getCreatorId() === $dataIsolation->getCurrentUserId()) {
                continue;
            }

            $userSkillEntity = $userSkillMap[$skillEntity->getCode()] ?? null;
            $skillVersionEntity = $userSkillEntity?->getSkillVersionId() !== null
                ? ($versionMap[$userSkillEntity->getSkillVersionId()] ?? null)
                : null;

            if ($userSkillEntity !== null && $skillVersionEntity !== null) {
                $skillEntities[$index] = $this->applyInstalledVersionSnapshotToSkill(
                    $skillEntity,
                    $userSkillEntity,
                    $skillVersionEntity
                );
                continue;
            }

            $publishedVersionEntity = $publishedVersionMap[$skillEntity->getCode()] ?? null;
            if ($publishedVersionEntity !== null) {
                $skillEntities[$index] = $this->applyPublishedVersionSnapshotToSkill(
                    $skillEntity,
                    $publishedVersionEntity
                );
            }
        }

        return $skillEntities;
    }

    public function findLatestSkillVersionByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findLatestByCode($dataIsolation, $code);
    }

    public function findLatestPublishedSkillVersionByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findLatestPublishedByCode($dataIsolation, $code);
    }

    public function findPendingReviewSkillVersionById(int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findPendingReviewById($id);
    }

    /**
     * @return SkillVersionEntity[]
     */
    public function findAllPublishedSkillVersionsByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        return $this->skillVersionRepository->findAllPublishedByCode($dataIsolation, $code);
    }

    /**
     * @return SkillVersionEntity[]
     */
    public function findAllSkillVersionsByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        return $this->skillVersionRepository->findAllByCode($dataIsolation, $code);
    }

    public function publishSkill(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillVersionEntity $versionEntity
    ): SkillVersionEntity {
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_PUBLISH, 'skill.store_skill_cannot_publish');
        }

        $publishTargetType = $versionEntity->getPublishTargetType();
        $publishType = PublishType::fromPublishTargetType($publishTargetType);

        if (
            $dataIsolation->getOrganizationInfoManager()->getOrganizationType() === OrganizationType::Personal
            && $publishType === PublishType::INTERNAL
            && $publishTargetType !== PublishTargetType::PRIVATE
        ) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_TYPE_INVALID, 'skill.publish_target_type_invalid');
        }

        if (! in_array($publishTargetType, [PublishTargetType::PRIVATE, PublishTargetType::MEMBER, PublishTargetType::ORGANIZATION, PublishTargetType::MARKET], true)) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_TYPE_INVALID, 'skill.publish_target_type_invalid');
        }

        if ($publishTargetType->requiresTargetValue()) {
            $publishTargetValue = $versionEntity->getPublishTargetValue();
            if ($publishTargetValue === null || ! $publishTargetValue->hasTargets()) {
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_VALUE_REQUIRED, 'skill.publish_target_value_required');
            }
        } elseif ($versionEntity->getPublishTargetValue() !== null) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_VALUE_SHOULD_BE_EMPTY, 'skill.publish_target_value_should_be_empty');
        }

        if ($this->skillVersionRepository->existsByCodeAndVersion($dataIsolation, $skillEntity->getCode(), $versionEntity->getVersion())) {
            ExceptionBuilder::throw(SkillErrorCode::VERSION_ALREADY_EXISTS, 'skill.version_already_exists');
        }

        $this->skillVersionRepository->invalidateAwaitingReviewVersionsByCode($dataIsolation, $skillEntity->getCode());

        $logoPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');
        $versionEntity->setCode($skillEntity->getCode());
        $versionEntity->setOrganizationCode($skillEntity->getOrganizationCode());
        $versionEntity->setCreatorId($skillEntity->getCreatorId());
        $versionEntity->setPackageName($skillEntity->getPackageName());
        $versionEntity->setPackageDescription($skillEntity->getPackageDescription());
        $versionEntity->setNameI18n($skillEntity->getNameI18n());
        $versionEntity->setDescriptionI18n($skillEntity->getDescriptionI18n());
        $versionEntity->setSourceI18n($skillEntity->getSourceI18n());
        $versionEntity->setLogo($logoPath ?: null);
        $versionEntity->setFileKey($skillEntity->getFileKey());
        $versionEntity->setSourceType($skillEntity->getSourceType());
        $versionEntity->setProjectId($skillEntity->getProjectId());
        $versionEntity->setPublisherUserId($dataIsolation->getCurrentUserId());

        if ($publishTargetType === PublishTargetType::PRIVATE) {
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::APPROVED);
            $versionEntity->setPublishedAt(date('Y-m-d H:i:s'));
            $versionEntity->setIsCurrentVersion(true);

            $this->skillVersionRepository->clearCurrentVersion($dataIsolation, $skillEntity->getCode());
            $versionEntity = $this->saveSkillVersion($dataIsolation, $versionEntity);

            $skillEntity->setLatestPublishedAt($versionEntity->getPublishedAt());
            $this->skillRepository->save($dataIsolation, $skillEntity);

            return $versionEntity;
        }

        $skillEntity->setLatestPublishedAt(date('Y-m-d H:i:s'));
        $this->skillRepository->save($dataIsolation, $skillEntity);

        $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
        $versionEntity->setReviewStatus(ReviewStatus::UNDER_REVIEW);
        $versionEntity->setPublishedAt(null);
        $versionEntity->setIsCurrentVersion(false);

        return $this->saveSkillVersion($dataIsolation, $versionEntity);
    }

    /**
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queryVersionsByCode(
        SkillDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array {
        $skillEntity = $this->getSkillByCodeOrFail($dataIsolation, $code);
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_PUBLISH, 'skill.store_skill_cannot_publish');
        }

        return $this->skillVersionRepository->queriesByCode(
            $dataIsolation,
            $code,
            $publishTargetType,
            $reviewStatus,
            $page
        );
    }

    public function countSkillVersionsByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        return $this->skillVersionRepository->countByCode($dataIsolation, $code);
    }

    public function clearCurrentVersionByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        return $this->skillVersionRepository->clearCurrentVersion($dataIsolation, $code);
    }

    /**
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queryVersions(
        SkillDataIsolation $dataIsolation,
        SkillVersionAdminQuery $query,
        Page $page
    ): array {
        return $this->skillVersionRepository->queryVersions(
            $dataIsolation,
            $query,
            $page
        );
    }

    public function offlineSkill(SkillDataIsolation $dataIsolation, string $code): void
    {
        $skillEntity = $this->getSkillByCodeOrFail($dataIsolation, $code);
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_PUBLISH, 'skill.store_skill_cannot_publish');
        }

        Db::beginTransaction();
        try {
            $publishedVersions = $this->findAllPublishedSkillVersionsByCode($dataIsolation, $code);
            if (empty($publishedVersions)) {
                ExceptionBuilder::throw(SkillErrorCode::NO_PUBLISHED_VERSION, 'skill.no_published_version');
            }

            foreach ($publishedVersions as $publishedVersion) {
                $publishedVersion->setPublishStatus(PublishStatus::OFFLINE);
                $this->saveSkillVersion($dataIsolation, $publishedVersion);
            }

            $this->skillMarketDomainService->updateAllPublishStatusBySkillCode($code, PublishStatus::OFFLINE->value);

            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    public function reviewOrganizationSkillVersion(
        SkillDataIsolation $dataIsolation,
        int $id,
        ReviewStatus $reviewStatus,
        ?string $reviewRemark = null
    ): SkillVersionEntity {
        $skillVersion = $this->skillVersionRepository->findById($dataIsolation, $id);
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        if (! $skillVersion->getPublishTargetType()->requiresOrganizationReview()) {
            ExceptionBuilder::throw(SkillErrorCode::CANNOT_REVIEW_VERSION, 'skill.cannot_review_version');
        }

        if (! $skillVersion->getPublishStatus()->isUnpublished()
            || ! $skillVersion->getReviewStatus()?->isUnderReview()) {
            ExceptionBuilder::throw(SkillErrorCode::CANNOT_REVIEW_VERSION, 'skill.cannot_review_version');
        }

        if ($reviewStatus === ReviewStatus::APPROVED) {
            $this->skillVersionRepository->clearCurrentVersion($dataIsolation, $skillVersion->getCode());
            $skillVersion->setReviewStatus(ReviewStatus::APPROVED);
            $skillVersion->setPublishStatus(PublishStatus::PUBLISHED);
            $skillVersion->setReviewRemark($reviewRemark);
            $skillVersion->setPublishedAt(date('Y-m-d H:i:s'));
            $skillVersion->setIsCurrentVersion(true);
            $skillVersion = $this->saveSkillVersion($dataIsolation, $skillVersion);

            $skillEntity = $this->getSkillByCodeOrFail($dataIsolation, $skillVersion->getCode());
            $skillEntity->setLatestPublishedAt($skillVersion->getPublishedAt());
            $this->skillRepository->save($dataIsolation, $skillEntity);

            return $skillVersion;
        }

        $skillVersion->setReviewStatus(ReviewStatus::REJECTED);
        $skillVersion->setPublishStatus(PublishStatus::UNPUBLISHED);
        $skillVersion->setReviewRemark($reviewRemark);
        return $this->saveSkillVersion($dataIsolation, $skillVersion);
    }

    public function reviewSkillVersion(
        SkillDataIsolation $dataIsolation,
        int $id,
        string $action,
        string $publisherType = '',
        ?string $reviewRemark = null
    ): void {
        $skillVersion = $this->findPendingReviewSkillVersionById($id);
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        if (! $skillVersion->getPublishStatus()->isUnpublished()
            || ! $skillVersion->getReviewStatus()?->isUnderReview()) {
            ExceptionBuilder::throw(SkillErrorCode::CANNOT_REVIEW_VERSION, 'skill.cannot_review_version');
        }

        if ($skillVersion->getPublishTargetType() !== PublishTargetType::MARKET) {
            ExceptionBuilder::throw(SkillErrorCode::CANNOT_REVIEW_VERSION, 'skill.cannot_review_version');
        }

        try {
            $reviewStatus = ReviewStatus::from($action);
        } catch (ValueError) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_REVIEW_ACTION, 'skill.invalid_review_action');
        }

        if ($reviewStatus === ReviewStatus::APPROVED) {
            if ($publisherType === '') {
                $publisherType = PublisherType::USER->value;
            }
            $this->approveSkillVersion($dataIsolation, $skillVersion, PublisherType::from($publisherType), $reviewRemark);
            return;
        }

        $this->rejectSkillVersion($dataIsolation, $skillVersion, $reviewRemark);
    }

    private function getSkillByCodeOrFail(SkillDataIsolation $dataIsolation, string $code): SkillEntity
    {
        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $code);
        if ($skillEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        return $skillEntity;
    }

    private function applyInstalledVersionSnapshotToSkill(
        SkillEntity $skillEntity,
        UserSkillEntity $userSkillEntity,
        SkillVersionEntity $skillVersionEntity
    ): SkillEntity {
        $skillEntity->setPackageName($skillVersionEntity->getPackageName());
        $skillEntity->setPackageDescription($skillVersionEntity->getPackageDescription());
        $skillEntity->setNameI18n($skillVersionEntity->getNameI18n());
        $skillEntity->setDescriptionI18n($skillVersionEntity->getDescriptionI18n());
        $skillEntity->setSourceI18n($skillVersionEntity->getSourceI18n());
        $skillEntity->setLogo($skillVersionEntity->getLogo());
        $skillEntity->setFileKey($skillVersionEntity->getFileKey() ?? '');
        $skillEntity->setSourceType($userSkillEntity->getSourceType());
        $skillEntity->setSourceId($userSkillEntity->getSourceId());
        $skillEntity->setVersionId($skillVersionEntity->getId());
        $skillEntity->setVersionCode($skillVersionEntity->getVersion());
        $skillEntity->setProjectId($skillVersionEntity->getProjectId());
        $skillEntity->setLatestPublishedAt($skillVersionEntity->getPublishedAt());
        $skillEntity->setCreatedAt($skillVersionEntity->getCreatedAt());
        $skillEntity->setUpdatedAt($skillVersionEntity->getUpdatedAt());

        return $skillEntity;
    }

    private function applyPublishedVersionSnapshotToSkill(
        SkillEntity $skillEntity,
        SkillVersionEntity $skillVersionEntity
    ): SkillEntity {
        $skillEntity->setPackageName($skillVersionEntity->getPackageName());
        $skillEntity->setPackageDescription($skillVersionEntity->getPackageDescription());
        $skillEntity->setNameI18n($skillVersionEntity->getNameI18n());
        $skillEntity->setDescriptionI18n($skillVersionEntity->getDescriptionI18n());
        $skillEntity->setSourceI18n($skillVersionEntity->getSourceI18n());
        $skillEntity->setLogo($skillVersionEntity->getLogo());
        $skillEntity->setFileKey($skillVersionEntity->getFileKey() ?? '');
        $skillEntity->setSourceType($skillVersionEntity->getSourceType());
        $skillEntity->setSourceId($skillVersionEntity->getSourceId());
        $skillEntity->setVersionId($skillVersionEntity->getId());
        $skillEntity->setVersionCode($skillVersionEntity->getVersion());
        $skillEntity->setProjectId($skillVersionEntity->getProjectId());
        $skillEntity->setLatestPublishedAt($skillVersionEntity->getPublishedAt());
        $skillEntity->setCreatedAt($skillVersionEntity->getCreatedAt());
        $skillEntity->setUpdatedAt($skillVersionEntity->getUpdatedAt());

        return $skillEntity;
    }

    private function approveSkillVersion(
        SkillDataIsolation $dataIsolation,
        SkillVersionEntity $skillVersion,
        PublisherType $publisherType,
        ?string $reviewRemark = null
    ): void {
        $dataIsolation->disabled();

        $this->skillVersionRepository->clearCurrentVersion($dataIsolation, $skillVersion->getCode());
        $skillVersion->setReviewStatus(ReviewStatus::APPROVED);
        $skillVersion->setPublishStatus(PublishStatus::PUBLISHED);
        $skillVersion->setReviewRemark($reviewRemark);
        $skillVersion->setPublishTargetType(PublishTargetType::MARKET);
        $skillVersion->setPublishedAt(date('Y-m-d H:i:s'));
        $skillVersion->setIsCurrentVersion(true);
        $this->saveSkillVersion($dataIsolation, $skillVersion);

        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $skillVersion->getCode());
        if (! $skillEntity) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }
        $skillEntity->setLatestPublishedAt($skillVersion->getPublishedAt());
        $this->skillRepository->save($dataIsolation, $skillEntity);

        $storeSkill = $this->skillMarketDomainService->findStoreSkillBySkillCode($skillVersion->getCode());
        $searchText = SkillMarketSearchTextBuilder::buildFromSkillVersion($skillVersion);

        if ($storeSkill) {
            $storeSkill->setOrganizationCode($skillVersion->getOrganizationCode());
            $storeSkill->setSkillVersionId($skillVersion->getId());
            $storeSkill->setNameI18n($skillVersion->getNameI18n());
            $storeSkill->setDescriptionI18n($skillVersion->getDescriptionI18n());
            $storeSkill->setSearchText($searchText);
            $storeSkill->setLogo($skillVersion->getLogo());
            $storeSkill->setPublisherType($publisherType);
            $storeSkill->setPublishStatus(PublishStatus::PUBLISHED);
            $this->skillMarketDomainService->saveStoreSkill($storeSkill);
            return;
        }

        $newStoreSkill = new SkillMarketEntity([
            'organization_code' => $skillVersion->getOrganizationCode(),
            'skill_code' => $skillVersion->getCode(),
            'skill_version_id' => $skillVersion->getId(),
            'name_i18n' => $skillVersion->getNameI18n(),
            'description_i18n' => $skillVersion->getDescriptionI18n(),
            'search_text' => $searchText,
            'logo' => $skillVersion->getLogo(),
            'publisher_id' => $skillVersion->getCreatorId(),
            'publisher_type' => $publisherType->value,
            'category_id' => null,
            'publish_status' => PublishStatus::PUBLISHED->value,
            'install_count' => 0,
        ]);
        $this->skillMarketDomainService->saveStoreSkill($newStoreSkill);
    }

    private function rejectSkillVersion(
        SkillDataIsolation $dataIsolation,
        SkillVersionEntity $skillVersion,
        ?string $reviewRemark = null
    ): void {
        $skillVersion->setReviewStatus(ReviewStatus::REJECTED);
        $skillVersion->setReviewRemark($reviewRemark);
        $this->saveSkillVersion($dataIsolation, $skillVersion);
    }
}
