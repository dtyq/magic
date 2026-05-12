<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\Domain\Market\Service\MarketSearchTextBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
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
        Page $page = new Page()
    ): array {
        return $this->agentVersionRepository->queriesByCode($dataIsolation, $code, $publishTargetType, $reviewStatus, $page);
    }

    public function countVersionsByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int
    {
        return $this->agentVersionRepository->countByCode($dataIsolation, $code);
    }

    public function findLatestVersionByCreatedAt(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findLatestByCreatedAtDesc($dataIsolation, $code);
    }

    public function getCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCode($dataIsolation, $code);
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
        ?string $reviewStatus,
        ?string $publishStatus,
        ?array $publishTargetTypes,
        ?string $version,
        ?string $organizationCode,
        ?string $nameI18n,
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        return $this->agentVersionRepository->queryVersions(
            $dataIsolation,
            $reviewStatus,
            $publishStatus,
            $publishTargetTypes,
            $version,
            $organizationCode,
            $nameI18n,
            $startTime,
            $endTime,
            $orderBy,
            $page
        );
    }

    public function publishAgent(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity
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

        $nameI18n = $agentEntity->getNameI18n();
        $name = $nameI18n[LanguageEnum::EN_US->value] ?? ($nameI18n[LanguageEnum::ZH_CN->value] ?? '');

        $descriptionI18n = $agentEntity->getDescriptionI18n();
        $description = '';
        if ($descriptionI18n) {
            $description = $descriptionI18n[LanguageEnum::EN_US->value] ?? ($descriptionI18n[LanguageEnum::ZH_CN->value] ?? '');
        }

        $versionEntity->setCode($agentEntity->getCode());
        $versionEntity->setOrganizationCode($agentEntity->getOrganizationCode());
        $versionEntity->setVersion($version);
        $versionEntity->setName($name);
        $versionEntity->setDescription($description);
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
        $versionEntity->setFileKey($agentEntity->getFileKey());

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
            $versionEntity->setPublisherUserId($versionEntity->getCreator());
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
            $storeAgentEntity->setCategoryId(null);
            $storeAgentEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $storeAgentEntity->setOrganizationCode($versionEntity->getOrganizationCode());

            if ($existingStoreAgent) {
                $storeAgentEntity->setId($existingStoreAgent->getId());
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

            $this->storeAgentRepository->saveOrUpdate($dataIsolation, $storeAgentEntity);
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
