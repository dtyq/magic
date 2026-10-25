<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Service;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateCodeAvailability;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Service\UsageCount\SlidesTemplateUsageCountPolicyInterface;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Database\Exception\QueryException;
use Hyperf\DbConnection\Db;
use Throwable;

class SlidesTemplateDomainService
{
    public function __construct(
        private readonly SlidesTemplateRepositoryInterface $slidesTemplateRepository,
        private readonly SlidesTemplateUsageCountPolicyInterface $usageCountPolicy,
        private readonly SlidesTemplateTagDomainService $slidesTemplateTagDomainService,
    ) {
    }

    public function findByIdOrFail(SlidesTemplateDataIsolation $dataIsolation, int|string $id): SlidesTemplateEntity
    {
        $entity = $this->slidesTemplateRepository->findById($dataIsolation, $id);
        if (! $entity || ! $this->isOfficialTemplate($dataIsolation, $entity)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
        return $entity;
    }

    /** Read a template for queue processing without applying the public official-only guard. */
    public function findByIdForSync(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateEntity
    {
        return $this->slidesTemplateRepository->findById($dataIsolation, $id);
    }

    /** Return one ID cursor page for the administrative full-sync endpoint. */
    public function findIdsForSync(
        SlidesTemplateDataIsolation $dataIsolation,
        string $organizationCode,
        array $templateIds,
        ?string $categoryCode,
        array $tagCodes,
        string $tagMatch,
        string $afterId,
        int $limit
    ): array {
        return $this->slidesTemplateRepository->findIdsForSync(
            $dataIsolation,
            $organizationCode,
            $templateIds,
            $categoryCode,
            $tagCodes,
            $tagMatch,
            $afterId,
            $limit,
        );
    }

    public function findEnabledByCodeOrFail(SlidesTemplateDataIsolation $dataIsolation, string $code): SlidesTemplateEntity
    {
        $entity = $this->findByCodeOrFail($dataIsolation, $code);
        $this->assertUserAccessible($dataIsolation, $entity);
        if (! $entity->getStatus()->isEnabled()) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
        return $entity;
    }

    public function findGloballyByCode(string $code): ?SlidesTemplateEntity
    {
        return $this->slidesTemplateRepository->findGloballyByCodeWithTrashed($code);
    }

    public function findByCodeOrFail(SlidesTemplateDataIsolation $dataIsolation, string $code): SlidesTemplateEntity
    {
        $entity = $this->slidesTemplateRepository->findByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
        return $entity;
    }

    /** @return SlidesTemplateEntity[] */
    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array
    {
        return $this->slidesTemplateRepository->findByCodes($dataIsolation, $codes);
    }

    /** Return templates in the same order as the supplied IDs for vector search results. */
    public function findByIds(SlidesTemplateDataIsolation $dataIsolation, array $ids): array
    {
        return $this->slidesTemplateRepository->findByIds($dataIsolation, $ids);
    }

    public function assertUserAccessible(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): void
    {
        $isAccessibleOfficial = $this->isOfficialTemplate($dataIsolation, $entity)
            && $entity->getStatus()->isEnabled();
        if (! $isAccessibleOfficial && ! $this->isOwnedByUser($dataIsolation, $entity)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
    }

    public function findOfficialByCodeOrFail(SlidesTemplateDataIsolation $dataIsolation, string $code): SlidesTemplateEntity
    {
        $entity = $this->slidesTemplateRepository->findOfficialByCode($dataIsolation, $code);
        if (! $entity || ! $this->isOfficialTemplate($dataIsolation, $entity)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
        return $entity;
    }

    /**
     * @return array{total: int, list: SlidesTemplateEntity[]}
     */
    public function queries(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        return $this->slidesTemplateRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * @return array{total: int, list: SlidesTemplateEntity[]}
     */
    public function queriesFavorites(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        $query->setScope(SlidesTemplateQueryScope::All);
        return $this->slidesTemplateRepository->queriesFavorites($dataIsolation, $query, $page);
    }

    /**
     * @return array{total: int, total_usage_count: int, template_count_today_growth: int}
     */
    public function getCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): array
    {
        return $this->usageCountPolicy->getCount($dataIsolation, $query);
    }

    public function create(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $entity,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = []
    ): SlidesTemplateEntity {
        if (! $dataIsolation->isOfficialOrganization()) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
        if ($this->findGloballyByCode($entity->getCode()) !== null) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS);
        }
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setOwnerType(SlidesTemplateOwnerType::Official)
            ->setOwnerId($dataIsolation->getCurrentOrganizationCode());

        $this->refreshSearchText($entity, $category, $tags);
        $totalUsageCount = max(0, $entity->getBaseUsageCount()) + max(0, $entity->getActualUsageCount());
        $entity->setTotalUsageCount($totalUsageCount);
        try {
            return $this->slidesTemplateRepository->save($dataIsolation, $entity);
        } catch (Throwable $throwable) {
            if ($this->isDuplicateCodeException($throwable)) {
                ExceptionBuilder::throw(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS);
            }

            throw $throwable;
        }
    }

    public function update(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $entity,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = []
    ): SlidesTemplateEntity {
        $existing = $this->findByIdOrFail($dataIsolation, (string) $entity->getId());
        $entity->setOrganizationCode($existing->getOrganizationCode())
            ->setOwnerType($existing->getOwnerType())
            ->setOwnerId($existing->getOwnerId());
        $this->refreshSearchText($entity, $category, $tags);
        $totalUsageCount = max(0, $entity->getBaseUsageCount()) + max(0, $entity->getActualUsageCount());
        $entity->setTotalUsageCount($totalUsageCount);
        return $this->slidesTemplateRepository->save($dataIsolation, $entity);
    }

    /** Persist a search_text refresh after a template-tag relation change. */
    public function saveSearchText(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity
    {
        return $this->slidesTemplateRepository->save($dataIsolation, $entity);
    }

    public function saveUserTemplate(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $entity,
        ?SlidesTemplateStatus $status = null,
        ?array $tagCodes = null,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = [],
    ): SlidesTemplateEntity {
        try {
            return $this->transaction(function () use ($dataIsolation, $entity, $status, $tagCodes, $category, $tags): SlidesTemplateEntity {
                if ($entity->getCode() === '') {
                    $entity->setCode($this->generateAvailableCode());
                }

                $existing = $this->findGloballyByCode($entity->getCode());
                $isCreate = $existing === null;
                if (! $isCreate) {
                    if ($existing->getDeletedAt() !== null || ! $this->isOwnedByUser($dataIsolation, $existing)) {
                        ExceptionBuilder::throw(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS);
                    }
                    $this->copyUserTemplateImmutableFields($entity, $existing);
                } else {
                    $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
                        ->setOwnerType(SlidesTemplateOwnerType::User)
                        ->setOwnerId($dataIsolation->getCurrentUserId())
                        ->setSourceType(SlidesTemplateSourceType::Custom)
                        ->setStatus($status ?? SlidesTemplateStatus::Enabled)
                        ->setSort(0)
                        ->setCreatedUid($dataIsolation->getCurrentUserId());
                }

                if (! $isCreate && $status !== null) {
                    $entity->setStatus($status);
                }
                $resolvedTags = $tags;
                if (! $isCreate && $tagCodes === null) {
                    $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$existing]);
                    $resolvedTags = $existing->getTags();
                }
                $entity->setUpdatedUid($dataIsolation->getCurrentUserId());
                // Keep database search_text in step with the template's current category and tags.
                $this->refreshSearchText($entity, $category, $resolvedTags);
                $entity->recalculateTotalUsageCount();
                $saved = $this->slidesTemplateRepository->save($dataIsolation, $entity);
                if ($tagCodes !== null) {
                    $this->slidesTemplateTagDomainService->syncTemplateTagsByCodes(
                        $dataIsolation,
                        (int) $saved->getId(),
                        $tagCodes,
                        $dataIsolation->getCurrentUserId()
                    );
                }
                return $saved;
            });
        } catch (Throwable $throwable) {
            if ($this->isDuplicateCodeException($throwable)) {
                ExceptionBuilder::throw(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS);
            }
            throw $throwable;
        }
    }

    public function getCodeAvailabilityForUser(
        SlidesTemplateDataIsolation $dataIsolation,
        string $code
    ): SlidesTemplateCodeAvailability {
        $existing = $this->findGloballyByCode($code);
        if (! $existing) {
            return SlidesTemplateCodeAvailability::Unused;
        }
        if ($existing->getDeletedAt() !== null) {
            return SlidesTemplateCodeAvailability::Occupied;
        }
        return $this->isOwnedByUser($dataIsolation, $existing)
            ? SlidesTemplateCodeAvailability::OwnedByMe
            : SlidesTemplateCodeAvailability::Occupied;
    }

    public function assertOwnedByUser(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): void
    {
        if (! $this->isOwnedByUser($dataIsolation, $entity)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::USER_TEMPLATE_ACCESS_DENIED);
        }
    }

    public function assertOfficialTemplate(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $entity
    ): void {
        if (! $this->isOfficialTemplate($dataIsolation, $entity)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
    }

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, SlidesTemplateStatus $status, string $updatedUid): void
    {
        if (! $this->slidesTemplateRepository->updateStatus($dataIsolation, $id, $status->value, $updatedUid)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
    }

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): void
    {
        if (! $this->slidesTemplateRepository->updateSort($dataIsolation, $id, $sort, $updatedUid)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
    }

    public function incrementActualUsageCount(SlidesTemplateDataIsolation $dataIsolation, string $code): void
    {
        $this->slidesTemplateRepository->incrementActualUsageCount(
            $dataIsolation,
            $code,
            1
        );
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): void
    {
        if (! $this->slidesTemplateRepository->delete($dataIsolation, $id)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND);
        }
    }

    protected function transaction(callable $callback): mixed
    {
        return Db::transaction($callback);
    }

    /** Rebuild database search text from template, category, and enabled tags. */
    private function refreshSearchText(
        SlidesTemplateEntity $entity,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = []
    ): void {
        $entity->setSearchText(SlidesTemplateSearchTextBuilder::build($entity, $category, $tags));
    }

    private function isOwnedByUser(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): bool
    {
        return $entity->getOrganizationCode() === $dataIsolation->getCurrentOrganizationCode()
            && $entity->getOwnerType()->isUser()
            && $entity->getOwnerId() === $dataIsolation->getCurrentUserId();
    }

    private function isOfficialTemplate(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $entity
    ): bool {
        return in_array($entity->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)
            && $entity->getOwnerType()->isOfficial()
            && $entity->getOwnerId() === $entity->getOrganizationCode();
    }

    private function copyUserTemplateImmutableFields(SlidesTemplateEntity $entity, SlidesTemplateEntity $existing): void
    {
        $entity->setId($existing->getId())
            ->setOrganizationCode($existing->getOrganizationCode())
            ->setOwnerType($existing->getOwnerType())
            ->setOwnerId($existing->getOwnerId())
            ->setSourceType($existing->getSourceType())
            ->setStatus($existing->getStatus())
            ->setSort($existing->getSort())
            ->setBaseUsageCount($existing->getBaseUsageCount())
            ->setActualUsageCount($existing->getActualUsageCount())
            ->setCreatedUid($existing->getCreatedUid())
            ->setCreatedAt($existing->getCreatedAt());
    }

    private function generateAvailableCode(): string
    {
        for ($attempt = 0; $attempt < 5; ++$attempt) {
            $code = SlidesTemplateEntity::generateNewCode();
            if ($this->findGloballyByCode($code) === null) {
                return $code;
            }
        }
        ExceptionBuilder::throw(SlidesTemplateErrorCode::CODE_GENERATE_FAILED);
    }

    private function isDuplicateCodeException(Throwable $throwable): bool
    {
        return $throwable instanceof QueryException
            && (string) $throwable->getCode() === '23000'
            && str_contains($throwable->getMessage(), 'Duplicate entry');
    }
}
