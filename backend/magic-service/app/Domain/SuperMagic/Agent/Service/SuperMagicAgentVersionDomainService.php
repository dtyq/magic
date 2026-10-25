<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentSkillEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentVersionAdminQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use App\Domain\SuperMagic\Common\Market\Service\MarketSearchTextBuilder;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\VersionUtil;
use Hyperf\DbConnection\Annotation\Transactional;

/**
 * Agent 版本领域服务.
 */
class SuperMagicAgentVersionDomainService
{
    public function __construct(
        protected AgentVersionRepositoryInterface $agentVersionRepository,
        protected SuperMagicAgentRepositoryInterface $superMagicAgentRepository,
        protected AgentSkillRepositoryInterface $agentSkillRepository,
        protected AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected AgentMarketRepositoryInterface $storeAgentRepository,
        protected SuperMagicAgentCategoryRelationDomainService $categoryRelationDomainService,
    ) {
    }

    /**
     * @return array{total:int, list: array<AgentVersionEntity>}
     */
    public function queriesByCode(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page(),
        bool $includePublishing = false
    ): array {
        return $this->agentVersionRepository->queriesByCode($dataIsolation, $code, $publishTargetType, $reviewStatus, $page, $includePublishing);
    }

    public function countVersionsByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int
    {
        return $this->agentVersionRepository->countByCode($dataIsolation, $code);
    }

    public function findLatestVersionByCreatedAt(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findLatestByCreatedAtDesc($dataIsolation, $code);
    }

    public function existsByCodeAndVersion(SuperMagicAgentDataIsolation $dataIsolation, string $code, string $version): bool
    {
        return $this->agentVersionRepository->existsByCodeAndVersion($dataIsolation, $code, $version);
    }

    public function getNextAvailableVersion(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?string $latestVersion
    ): string {
        $nextVersion = VersionUtil::getNextVersion($latestVersion);
        while ($this->existsByCodeAndVersion($dataIsolation, $code, $nextVersion)) {
            $nextVersion = VersionUtil::getNextVersion($nextVersion);
        }

        return $nextVersion;
    }

    public function getCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCode($dataIsolation, $code);
    }

    public function getCurrentVersionByCodeForUpdate(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code
    ): ?AgentVersionEntity {
        return $this->agentVersionRepository->findCurrentVersionByCodeForUpdate($dataIsolation, $code);
    }

    public function findByIdWithoutOrganizationFilter(int $id): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findById($id);
    }

    /**
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function getCurrentOrLatestByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCodes($dataIsolation, $codes);
    }

    /**
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function getLatestPublishedByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
    {
        return $this->agentVersionRepository->findLatestPublishedByCodes($dataIsolation, $codes);
    }

    /**
     * 获取跨组织公开 Agent 的当前已发布版本。
     *
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function getLatestPublishedByCodesWithoutOrganizationFilter(array $codes): array
    {
        return $this->agentVersionRepository->findLatestPublishedByCodesWithoutOrganizationFilter($codes);
    }

    /**
     * @return array{total: int, list: AgentVersionEntity[]}
     */
    public function queries(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionQuery $query,
        Page $page
    ): array {
        return $this->agentVersionRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * @param array<int> $ids
     * @return array<int, AgentVersionEntity>
     */
    public function findByIdsWithoutOrganizationFilter(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        if ($ids === []) {
            return [];
        }

        $result = [];
        foreach ($ids as $id) {
            $entity = $this->agentVersionRepository->findById((int) $id);
            if ($entity !== null) {
                $result[(int) $id] = $entity;
            }
        }

        return $result;
    }

    /**
     * @return array{list: AgentVersionEntity[], total: int}
     */
    public function queryVersions(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionAdminQuery $query,
        Page $page
    ): array {
        return $this->agentVersionRepository->queryVersions(
            $dataIsolation,
            $query,
            $page
        );
    }

    public function publishAgent(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity,
        bool $prepareOnly = false
    ): AgentVersionEntity {
        if ($agentEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::StoreAgentCannotPublish, 'super_magic.agent.store_agent_cannot_publish');
        }

        $publishTargetType = $versionEntity->getPublishTargetType();
        $publishType = PublishType::fromPublishTargetType($publishTargetType);

        if (
            $dataIsolation->getOrganizationInfoManager()->getOrganizationType() === OrganizationType::Personal
            && $publishType === PublishType::INTERNAL
            && $publishTargetType !== PublishTargetType::PRIVATE
        ) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.publish_target_type_invalid');
        }

        if (! in_array($publishTargetType, [PublishTargetType::PRIVATE, PublishTargetType::MEMBER, PublishTargetType::ORGANIZATION, PublishTargetType::MARKET], true)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.publish_target_type_invalid');
        }

        $publishTargetValue = $versionEntity->getPublishTargetValue();
        if ($publishTargetType->requiresTargetValue()) {
            if ($publishTargetValue === null || ! $publishTargetValue->hasTargets()) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.publish_target_value_required');
            }
        } elseif ($publishTargetValue !== null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.publish_target_value_should_be_empty');
        }

        $version = $versionEntity->getVersion();
        if ($this->agentVersionRepository->existsByCodeAndVersion($dataIsolation, $agentEntity->getCode(), $version)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.version_already_exists');
        }

        $this->agentVersionRepository->invalidateAwaitingReviewVersionsByCode($dataIsolation, $agentEntity->getCode());

        $agentEntity->hydrateScalarTextForWrite();

        $versionEntity->setCode($agentEntity->getCode());
        $versionEntity->setOrganizationCode($agentEntity->getOrganizationCode());
        $versionEntity->setVersion($version);
        $versionEntity->setName($agentEntity->getName());
        $versionEntity->setDescription($agentEntity->getDescription());
        $versionEntity->setIcon($agentEntity->getIcon());
        $versionEntity->setIconType($agentEntity->getIconType());
        $versionEntity->setType($agentEntity->getType()->value);
        $versionEntity->setEnabled($agentEntity->isEnabled());
        $versionEntity->setPrompt($agentEntity->getPrompt());
        $versionEntity->setTools($agentEntity->getTools());
        $versionEntity->setCreator($agentEntity->getCreator());
        $versionEntity->setModifier($agentEntity->getCreator());
        $versionEntity->setNameI18n($agentEntity->getNameI18n());
        $versionEntity->setRoleI18n($agentEntity->getRoleI18n());
        $versionEntity->setDescriptionI18n($agentEntity->getDescriptionI18n());
        $versionEntity->setPublishTargetType($publishTargetType);
        $versionEntity->setPublishTargetValue($publishTargetValue);
        $versionEntity->setPublisherUserId($dataIsolation->getCurrentUserId());
        $versionEntity->setProjectId($agentEntity->getProjectId());
        // 异步 prepare 阶段尚未生成压缩包，使用空字符串占位，避免持久化 NULL。
        $versionEntity->setFileKey($prepareOnly ? '' : $agentEntity->getFileKey());

        if ($prepareOnly) {
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHING);
            $versionEntity->setReviewStatus(ReviewStatus::PENDING);
            $versionEntity->setPublishedAt(null);
            $versionEntity->setIsCurrentVersion(false);
            $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);
            $agentSkills = $this->agentSkillRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentEntity->getCode());
            if ($agentSkills !== []) {
                $skillEntities = [];
                foreach ($agentSkills as $agentSkill) {
                    $newSkillEntity = new AgentSkillEntity();
                    $newSkillEntity->setAgentId($agentEntity->getId());
                    $newSkillEntity->setAgentCode($agentSkill->getAgentCode());
                    $newSkillEntity->setSkillId($agentSkill->getSkillId());
                    $newSkillEntity->setSkillVersionId($agentSkill->getSkillVersionId());
                    $newSkillEntity->setSkillCode($agentSkill->getSkillCode());
                    $newSkillEntity->setSortOrder($agentSkill->getSortOrder());
                    $newSkillEntity->setCreatorId($agentSkill->getCreatorId());
                    $newSkillEntity->setAgentVersionId($versionEntity->getId());
                    $newSkillEntity->setOrganizationCode($agentSkill->getOrganizationCode());
                    $skillEntities[] = $newSkillEntity;
                }
                $this->agentSkillRepository->batchSave($dataIsolation, $skillEntities);
            }
            $this->agentPlaybookRepository->batchCopyToVersion($dataIsolation, $agentEntity->getId(), $versionEntity->getId());
            return $versionEntity;
        }

        if ($publishTargetType === PublishTargetType::PRIVATE) {
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::APPROVED);
            $versionEntity->setPublishedAt(date('Y-m-d H:i:s'));
            $versionEntity->setIsCurrentVersion(true);

            $this->agentVersionRepository->clearCurrentVersion($dataIsolation, $agentEntity->getCode());
            $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);

            $agentEntity->setLatestPublishedAt($versionEntity->getPublishedAt());
            $agentEntity->setModifier($dataIsolation->getCurrentUserId());
            $this->superMagicAgentRepository->save($dataIsolation, $agentEntity);
        } else {
            $agentEntity->setLatestPublishedAt(date('Y-m-d H:i:s'));
            $this->superMagicAgentRepository->save($dataIsolation, $agentEntity);

            $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::UNDER_REVIEW);
            $versionEntity->setPublishedAt(null);
            $versionEntity->setIsCurrentVersion(false);
            $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);
        }

        $agentSkills = $this->agentSkillRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentEntity->getCode());
        if (! empty($agentSkills)) {
            $skillEntities = [];
            foreach ($agentSkills as $agentSkill) {
                $newSkillEntity = new AgentSkillEntity();
                $newSkillEntity->setAgentId($agentEntity->getId());
                $newSkillEntity->setAgentCode($agentSkill->getAgentCode());
                $newSkillEntity->setSkillId($agentSkill->getSkillId());
                $newSkillEntity->setSkillVersionId($agentSkill->getSkillVersionId());
                $newSkillEntity->setSkillCode($agentSkill->getSkillCode());
                $newSkillEntity->setSortOrder($agentSkill->getSortOrder());
                $newSkillEntity->setCreatorId($agentSkill->getCreatorId());
                $newSkillEntity->setAgentVersionId($versionEntity->getId());
                $newSkillEntity->setOrganizationCode($agentSkill->getOrganizationCode());
                $skillEntities[] = $newSkillEntity;
            }
            $this->agentSkillRepository->batchSave($dataIsolation, $skillEntities);
        }

        $this->agentPlaybookRepository->batchCopyToVersion($dataIsolation, $agentEntity->getId(), $versionEntity->getId());

        return $versionEntity;
    }

    /** 将已完成 Sandbox 导出的 Agent 版本落库。 */
    public function finalizePreparedAgent(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $versionId,
        string $fileKey
    ): AgentVersionEntity {
        $versionEntity = $this->agentVersionRepository->findByIdForUpdate($dataIsolation, $versionId);
        if ($versionEntity === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }
        if (! $versionEntity->getPublishStatus()->isPublishing()) {
            return $versionEntity;
        }

        $versionEntity->setFileKey($fileKey);
        if ($versionEntity->getPublishTargetType() === PublishTargetType::PRIVATE) {
            $this->agentVersionRepository->clearCurrentVersion($dataIsolation, $versionEntity->getCode());
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::APPROVED);
            $versionEntity->setPublishedAt(date('Y-m-d H:i:s'));
            $versionEntity->setIsCurrentVersion(true);
        } else {
            $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
            $versionEntity->setReviewStatus(ReviewStatus::UNDER_REVIEW);
            $versionEntity->setPublishedAt(null);
            $versionEntity->setIsCurrentVersion(false);
        }
        $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);
        $agentEntity = $this->superMagicAgentRepository->getByCode($dataIsolation, $versionEntity->getCode());
        if ($agentEntity !== null) {
            $agentEntity->setLatestPublishedAt(date('Y-m-d H:i:s'));
            $agentEntity->setModifier($dataIsolation->getCurrentUserId());
            $this->superMagicAgentRepository->save($dataIsolation, $agentEntity);
        }
        return $versionEntity;
    }

    #[Transactional]
    public function reviewOrganizationAgentVersion(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $versionId,
        ReviewStatus $reviewStatus,
        string $modifier,
        ?string $reviewRemark = null
    ): AgentVersionEntity {
        $versionEntity = $this->agentVersionRepository->findPendingReviewById($dataIsolation, $versionId);
        if (! $versionEntity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }

        if (! $versionEntity->getPublishTargetType()->requiresOrganizationReview()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::CanOnlyReviewPendingVersion, 'super_magic.agent.can_only_review_pending_version');
        }

        if ($reviewStatus === ReviewStatus::APPROVED) {
            $this->agentVersionRepository->clearCurrentVersion($dataIsolation, $versionEntity->getCode());
            $versionEntity->setReviewStatus(ReviewStatus::APPROVED);
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $versionEntity->setReviewRemark($reviewRemark);
            $versionEntity->setPublishedAt(date('Y-m-d H:i:s'));
            $versionEntity->setIsCurrentVersion(true);
            $versionEntity->setModifier($modifier);
            $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);

            $agentEntity = $this->superMagicAgentRepository->getByCode($dataIsolation, $versionEntity->getCode());
            if (! $agentEntity) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $versionEntity->getCode()]);
            }
            $agentEntity->setLatestPublishedAt($versionEntity->getPublishedAt());
            $agentEntity->setModifier($modifier);
            $this->superMagicAgentRepository->save($dataIsolation, $agentEntity);

            return $versionEntity;
        }

        $versionEntity->setReviewStatus(ReviewStatus::REJECTED);
        $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
        $versionEntity->setReviewRemark($reviewRemark);
        $versionEntity->setModifier($modifier);
        return $this->agentVersionRepository->save($dataIsolation, $versionEntity);
    }

    /**
     * 将已通过组织审核的版本写入组织共享市场。
     */
    public function publishOrganizationSharedMarket(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionEntity $versionEntity
    ): AgentMarketEntity {
        // Serialize market ownership with resource transfer in the surrounding publish transaction.
        $agent = $this->superMagicAgentRepository->getByCode($dataIsolation, $versionEntity->getCode(), true);
        if ($agent === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $versionEntity->getCode()]);
        }
        $existingMarket = $this->storeAgentRepository->findByAgentCodeWithoutStatus($versionEntity->getCode());

        $marketEntity = new AgentMarketEntity();
        $marketEntity->setAgentCode($versionEntity->getCode());
        $marketEntity->setAgentVersionId((int) $versionEntity->getId());
        $marketEntity->setNameI18n($versionEntity->getNameI18n());
        $marketEntity->setDescriptionI18n($versionEntity->getDescriptionI18n());
        $marketEntity->setRoleI18n($versionEntity->getRoleI18n());
        $marketEntity->setSearchText(MarketSearchTextBuilder::build(
            [$versionEntity->getName(), $versionEntity->getDescription(), $versionEntity->getVersion()],
            [
                $versionEntity->getNameI18n() ?? [],
                $versionEntity->getRoleI18n() ?? [],
                $versionEntity->getDescriptionI18n() ?? [],
                $versionEntity->getVersionDescriptionI18n() ?? [],
            ]
        ));
        $marketEntity->setIcon($versionEntity->getIcon());
        // Market responsibility follows the current owner; the published version retains its author.
        $marketEntity->setPublisherId($agent->getCreator());
        $marketEntity->setPublisherType(PublisherType::USER);
        $marketEntity->setCategoryIds($this->categoryRelationDomainService->getVersionCategoryIds((int) $versionEntity->getId()));
        $marketEntity->setPublishStatus(PublishStatus::PUBLISHED);
        $marketEntity->setOrganizationCode($versionEntity->getOrganizationCode());
        $marketEntity->setMarketType(AgentMarketType::ORGANIZATION);

        if ($existingMarket !== null) {
            $marketEntity->setId($existingMarket->getId());
            $marketEntity->setInstallCount($existingMarket->getInstallCount());
            $marketEntity->setIsHidden($existingMarket->isHidden());
            $marketEntity->setIsFeatured($existingMarket->isFeatured());
            $marketEntity->setSortOrder($existingMarket->getSortOrder());
        }

        return $this->storeAgentRepository->saveOrUpdate($dataIsolation, $marketEntity);
    }

    #[Transactional]
    public function reviewAgentVersion(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $versionId,
        string $action,
        string $modifier,
        ?string $publisherType = null,
        ?bool $marketIsFeatured = null,
        ?int $marketSortOrder = null,
        ?string $reviewRemark = null
    ): void {
        $dataIsolation->disabled();

        $versionEntity = $this->agentVersionRepository->findPendingReviewById($dataIsolation, $versionId);
        if (! $versionEntity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }

        if ($versionEntity->getPublishStatus() !== PublishStatus::UNPUBLISHED
            || $versionEntity->getReviewStatus() !== ReviewStatus::UNDER_REVIEW) {
            ExceptionBuilder::throw(SuperMagicErrorCode::CanOnlyReviewPendingVersion, 'super_magic.agent.can_only_review_pending_version');
        }

        if ($versionEntity->getPublishTargetType() !== PublishTargetType::MARKET) {
            ExceptionBuilder::throw(SuperMagicErrorCode::CanOnlyReviewPendingVersion, 'super_magic.agent.can_only_review_pending_version');
        }

        if ($action === 'APPROVED') {
            $success = $this->agentVersionRepository->updateReviewStatus(
                $dataIsolation,
                $versionId,
                ReviewStatus::APPROVED,
                PublishStatus::PUBLISHED,
                $modifier
            );

            if (! $success) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.operation_failed');
            }

            $this->agentVersionRepository->clearCurrentVersion($dataIsolation, $versionEntity->getCode());
            $versionEntity->setPublishTargetType(PublishTargetType::MARKET);
            $versionEntity->setIsCurrentVersion(true);
            $versionEntity->setPublishedAt(date('Y-m-d H:i:s'));
            $versionEntity->setReviewStatus(ReviewStatus::APPROVED);
            $versionEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $versionEntity->setReviewRemark($reviewRemark);
            $versionEntity->setModifier($modifier);
            $this->agentVersionRepository->save($dataIsolation, $versionEntity);

            $agentEntity = $this->superMagicAgentRepository->getByCode($dataIsolation, $versionEntity->getCode());
            if (! $agentEntity) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $versionEntity->getCode()]);
            }
            $agentEntity->setLatestPublishedAt($versionEntity->getPublishedAt());
            $agentEntity->setModifier($modifier);
            $this->superMagicAgentRepository->save($dataIsolation, $agentEntity);

            $publisherTypeEnum = PublisherType::USER;
            if ($publisherType) {
                $publisherTypeEnum = PublisherType::from($publisherType);
            }

            $existingStoreAgent = $this->storeAgentRepository->findByAgentCodeWithoutStatus($versionEntity->getCode());

            $storeAgentEntity = new AgentMarketEntity();
            $storeAgentEntity->setAgentCode($versionEntity->getCode());
            $storeAgentEntity->setAgentVersionId($versionEntity->getId());
            $storeAgentEntity->setNameI18n($versionEntity->getNameI18n());
            $storeAgentEntity->setDescriptionI18n($versionEntity->getDescriptionI18n());
            $storeAgentEntity->setRoleI18n($versionEntity->getRoleI18n());
            $storeAgentEntity->setSearchText(MarketSearchTextBuilder::build(
                [
                    $versionEntity->getName(),
                    $versionEntity->getDescription(),
                    $versionEntity->getVersion(),
                ],
                [
                    $versionEntity->getNameI18n() ?? [],
                    $versionEntity->getRoleI18n() ?? [],
                    $versionEntity->getDescriptionI18n() ?? [],
                    $versionEntity->getVersionDescriptionI18n() ?? [],
                ]
            ));
            $storeAgentEntity->setIcon($versionEntity->getIcon());
            $storeAgentEntity->setPublisherId($versionEntity->getCreator());
            $storeAgentEntity->setPublisherType($publisherTypeEnum);
            $categoryIds = $this->categoryRelationDomainService->getVersionCategoryIds((int) $versionEntity->getId());
            $storeAgentEntity->setCategoryIds($categoryIds);
            $storeAgentEntity->setPublishStatus(PublishStatus::PUBLISHED);
            // 归属组织用于文件等资源上下文，公开性质由 market_type 明确定义。
            $storeAgentEntity->setOrganizationCode($versionEntity->getOrganizationCode());
            $storeAgentEntity->setMarketType(AgentMarketType::MARKET);

            if ($existingStoreAgent) {
                $storeAgentEntity->setId($existingStoreAgent->getId());
                $storeAgentEntity->setInstallCount($existingStoreAgent->getInstallCount());
                $storeAgentEntity->setIsHidden($existingStoreAgent->isHidden());
            }

            if ($marketIsFeatured !== null) {
                $storeAgentEntity->setIsFeatured($marketIsFeatured);
            } elseif ($existingStoreAgent !== null) {
                $storeAgentEntity->setIsFeatured($existingStoreAgent->isFeatured());
            }

            if ($marketSortOrder !== null) {
                $storeAgentEntity->setSortOrder($marketSortOrder);
            } elseif ($existingStoreAgent !== null) {
                $storeAgentEntity->setSortOrder($existingStoreAgent->getSortOrder());
            }

            $storeAgentEntity = $this->storeAgentRepository->saveOrUpdate($dataIsolation, $storeAgentEntity);
            if ($storeAgentEntity->getId() !== null) {
                $this->categoryRelationDomainService->replaceMarketCategories(
                    $dataIsolation,
                    $storeAgentEntity->getId(),
                    $categoryIds
                );
            }
            return;
        }

        $success = $this->agentVersionRepository->updateReviewStatus(
            $dataIsolation,
            $versionId,
            ReviewStatus::REJECTED,
            PublishStatus::UNPUBLISHED,
            $modifier,
            $reviewRemark
        );

        if (! $success) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.operation_failed');
        }
    }
}
