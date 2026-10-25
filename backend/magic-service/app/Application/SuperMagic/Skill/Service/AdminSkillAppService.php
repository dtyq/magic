<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Application\SuperMagic\Review\Service\ReviewNotificationAppService;
use App\Application\SuperMagic\Skill\Assembler\AdminSkillAssembler;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillVersionAdminQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Event\SkillMarketBatchReindexRequestedEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketOfflineEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketPublishedEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketUpdatedEvent;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketVectorIndexDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillMarketsRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ReviewOrganizationSkillVersionRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillMarketRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\QuerySkillMarketsResponseAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\QuerySkillVersionsResponseAdminDTO;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Psr\Container\ContainerInterface;
use Throwable;

/**
 * 后台管理 Skill 应用服务.
 */
class AdminSkillAppService extends AbstractSkillAppService
{
    use HasLogger;

    private const VECTOR_REINDEX_EVENT_BATCH_SIZE = 100;

    #[Inject]
    protected ContainerInterface $container;

    public function __construct(
        protected SkillDomainService $skillDomainService,
        protected SkillVersionDomainService $skillVersionDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        protected SkillCategoryRelationDomainService $skillCategoryRelationDomainService,
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
        private readonly AdminSkillAssembler $adminSkillAssembler,
        private readonly SkillMarketVectorIndexDomainService $skillMarketVectorIndexDomainService,
    ) {
    }

    public function queryVersions(
        RequestContext $requestContext,
        QuerySkillVersionsRequestAdminDTO $requestDTO
    ): QuerySkillVersionsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $query = $this->buildSkillVersionAdminQuery(
            $requestDTO,
            PublishTargetType::filterValues(PublishTargetType::MARKET->value),
            $requestDTO->getOrganizationCode()
        );
        $result = $this->skillVersionDomainService->queryVersions(
            $dataIsolation,
            $query,
            $page
        );
        /** @var SkillVersionEntity[] $versions */
        $versions = $result['list'];
        [$publishTargetUserMap, $memberDepartmentMap] = $this->batchLoadSkillVersionRelatedEntities(null, $versions);

        return $this->adminSkillAssembler->createQueryVersionsResponseDTO(
            $versions,
            $page,
            $result['total'],
            $publishTargetUserMap,
            $memberDepartmentMap
        );
    }

    public function queryMarkets(
        RequestContext $requestContext,
        QuerySkillMarketsRequestAdminDTO $requestDTO
    ): QuerySkillMarketsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->skillMarketDomainService->queryAdminMarkets(
            $requestDTO->getPublishStatus(),
            $requestDTO->getOrganizationCode(),
            $requestDTO->getNameI18n(),
            $requestDTO->getPublisherType(),
            $requestDTO->getSkillCode(),
            $requestDTO->getPackageName(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getCategoryIds(),
            $requestDTO->getOrderBy(),
            $page
        );

        $categoryIdsMap = $this->skillCategoryRelationDomainService->getMarketCategoryIdsMap(
            array_map(static fn (SkillMarketEntity $entity) => (int) $entity->getId(), $result['list'])
        );

        return $this->adminSkillAssembler->createQueryMarketsResponseDTO(
            $result['list'],
            $page,
            $result['total'],
            $categoryIdsMap
        );
    }

    /** Run the complete vector-index reconciliation for the current Skill market. */
    public function reindexMarketVectors(RequestContext $requestContext, bool $forceReEmbedding = false): array
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        return $this->reconcileMarketVectorIndex($dataIsolation, $forceReEmbedding);
    }

    /** Backfill published market versions whose SKILL.md snapshot is missing. */
    public function repairSkillFileUrls(RequestContext $requestContext): array
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();
        $afterId = 0;
        $total = $updated = $skipped = $failed = 0;
        $errors = [];
        while (true) {
            $batch = $this->skillMarketDomainService->findPublishedWithoutSkillFileByIdCursor($afterId);
            if ($batch === []) {
                break;
            }

            $versionIds = array_map(
                static fn (SkillMarketEntity $market): int => (int) $market->getSkillVersionId(),
                $batch
            );
            $versions = $this->skillVersionDomainService->findSkillVersionsByIdsWithoutOrganizationFilter($versionIds);
            $total += count($versions);
            foreach ($versions as $version) {
                $fileKey = $version->getFileKey();
                if ($fileKey === null || trim($fileKey) === '') {
                    ++$skipped;
                    $this->logger->info('Skill file URL repair skipped', [
                        'version_id' => $version->getId(),
                        'skill_code' => $version->getCode(),
                        'source_type' => $version->getSourceType()->value,
                        'reason' => 'empty_file_key',
                    ]);
                    continue;
                }

                try {
                    $version->setSkillFileKey($this->uploadSkillFileFromPackage($version));
                    $this->skillVersionDomainService->saveSkillVersion($dataIsolation, $version);
                    ++$updated;
                } catch (Throwable $throwable) {
                    ++$failed;
                    $errors[] = ['version_id' => $version->getId(), 'message' => $throwable->getMessage()];
                    $this->logger->error('Skill file URL repair failed', [
                        'version_id' => $version->getId(),
                        'skill_code' => $version->getCode(),
                        'exception' => $throwable::class,
                        'message' => $throwable->getMessage(),
                    ]);
                }
            }
            $afterId = (int) $batch[array_key_last($batch)]->getId();
        }

        return ['total' => $total, 'updated' => $updated, 'skipped' => $skipped, 'failed' => $failed, 'errors' => $errors];
    }

    public function repairSkillFileUrlsAsync(MagicUserAuthorization $authorization): void
    {
        $coroutineId = Coroutine::id();
        Coroutine::create(function () use ($authorization, $coroutineId): void {
            CoContext::copy($coroutineId);
            try {
                $requestContext = new RequestContext();
                $requestContext->setUserAuthorization($authorization);
                $result = $this->repairSkillFileUrls($requestContext);
                $this->logger->info('Skill file URL repair finished', $result);
            } catch (Throwable $throwable) {
                $this->logger->error('Skill file URL repair failed', [
                    'exception' => $throwable::class,
                    'message' => $throwable->getMessage(),
                ]);
            }
        });
    }

    /** Clean orphan points and queue every visible market Skill for reconciliation. */
    public function reconcileMarketVectorIndex(
        SkillDataIsolation $dataIsolation,
        bool $forceReEmbedding = false,
    ): array {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $reconcileSucceeded = true;
        $removed = 0;
        try {
            $removed = $this->skillMarketVectorIndexDomainService->removeOrphanPoints();
        } catch (Throwable $throwable) {
            $reconcileSucceeded = false;
            $this->logger->error('Skill market orphan vector cleanup failed', [
                'organization_code' => $organizationCode,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }

        $queued = 0;
        try {
            $result = $this->reindexAllMarketVectors($dataIsolation, $forceReEmbedding);
            $queued = $result['queued'] ?? 0;
        } catch (Throwable $throwable) {
            $reconcileSucceeded = false;
            $this->logger->error('Skill market vector reconciliation failed', [
                'organization_code' => $organizationCode,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }

        $this->logger->info('Skill market vector reconciliation finished', [
            'organization_code' => $organizationCode,
            'removed_orphans' => $removed,
            'queued' => $queued,
            'force_re_embedding' => $forceReEmbedding,
        ]);

        if ($reconcileSucceeded && $this->skillMarketVectorIndexDomainService->isVectorSearchEnabled()) {
            $this->skillMarketVectorIndexDomainService->markVectorIndexInitialized();
        }

        return ['removed_orphans' => $removed, 'queued' => $queued];
    }

    /** Queue all matching market records without requiring an HTTP request context. */
    public function reindexAllMarketVectors(
        SkillDataIsolation $dataIsolation,
        bool $forceReEmbedding = false,
    ): array {
        if (! $this->skillMarketVectorIndexDomainService->isVectorSearchEnabled()) {
            $this->logger->info('Skill market vector reindex skipped because embedding ability is disabled', [
                'force_re_embedding' => $forceReEmbedding,
            ]);
            return ['task_id' => bin2hex(random_bytes(12)), 'queued' => 0, 'after_id' => '0'];
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $operatorId = $dataIsolation->getCurrentUserId();
        $batchSize = self::VECTOR_REINDEX_EVENT_BATCH_SIZE;
        $queued = 0;
        $nextAfterId = '0';

        while (true) {
            $ids = $this->skillMarketDomainService->findVectorIndexIds(
                [],
                [],
                null,
                $nextAfterId,
                $batchSize,
            );
            if ($ids === []) {
                break;
            }

            foreach (array_chunk($ids, self::VECTOR_REINDEX_EVENT_BATCH_SIZE) as $batchIds) {
                AsyncEventUtil::dispatch(new SkillMarketBatchReindexRequestedEvent(
                    array_values(array_map('strval', $batchIds)),
                    $organizationCode,
                    $operatorId,
                    $forceReEmbedding,
                ));
            }

            $queued += count($ids);
            $previousAfterId = $nextAfterId;
            $lastId = (string) $ids[array_key_last($ids)];
            $nextAfterId = $lastId;
            if (count($ids) < $batchSize || $lastId === $previousAfterId) {
                break;
            }
        }

        return [
            'task_id' => bin2hex(random_bytes(12)),
            'queued' => $queued,
            'after_id' => $nextAfterId,
            'has_more' => false,
        ];
    }

    /**
     * 查询当前组织内待审核/已审核的 Skill 版本。
     * 仅包含发布到组织或指定成员范围的版本，不包含市场发布版本。
     */
    public function queryOrganizationVersions(
        RequestContext $requestContext,
        QuerySkillVersionsRequestAdminDTO $requestDTO
    ): QuerySkillVersionsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $publishTargetTypes = PublishTargetType::resolveOrganizationReviewFilterValues($requestDTO->getPublishTargetType());

        if ($publishTargetTypes === []) {
            return $this->adminSkillAssembler->createQueryVersionsResponseDTO([], $page, 0);
        }

        $query = $this->buildSkillVersionAdminQuery(
            $requestDTO,
            $publishTargetTypes,
            $dataIsolation->getCurrentOrganizationCode(),
            [ReviewStatus::INVALIDATED->value]
        );
        $result = $this->skillVersionDomainService->queryVersions(
            $dataIsolation,
            $query,
            $page
        );
        /** @var SkillVersionEntity[] $versions */
        $versions = $result['list'];
        [$publishTargetUserMap, $memberDepartmentMap] = $this->batchLoadSkillVersionRelatedEntities(null, $versions);

        return $this->adminSkillAssembler->createQueryVersionsResponseDTO(
            $versions,
            $page,
            $result['total'],
            $publishTargetUserMap,
            $memberDepartmentMap
        );
    }

    /**
     * 组织后台审核 Skill 版本，按 action 分发通过或拒绝逻辑。
     */
    public function reviewOrganizationVersion(RequestContext $requestContext, int $id, ReviewOrganizationSkillVersionRequestDTO $requestDTO): void
    {
        if ($requestDTO->isApproved()) {
            $this->approveOrganizationVersion($requestContext, $id, $requestDTO->getReviewRemark());
            return;
        }

        $this->rejectOrganizationVersion($requestContext, $id, $requestDTO->getReviewRemark());
    }

    /**
     * 组织后台审核通过 Skill 版本，并按发布目标同步组织内可见范围。
     */
    public function approveOrganizationVersion(RequestContext $requestContext, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        Db::beginTransaction();
        try {
            $versionEntity = $this->skillVersionDomainService->reviewOrganizationSkillVersion(
                $dataIsolation,
                $id,
                ReviewStatus::APPROVED,
                $reviewRemark
            );
            $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $versionEntity->getCode());
            $this->syncOrganizationSkillScope($dataIsolation, $skillEntity, $versionEntity);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        try {
            $this->container->get(ReviewNotificationAppService::class)->publishSkillApproved($versionEntity, (string) ($skillEntity?->getId() ?? ''));
        } catch (Throwable $throwable) {
            // Notification delivery must not invalidate the committed approval.
            $this->logger->warning('Skill approval notification failed', ['version_id' => $id, 'error' => $throwable->getMessage()]);
        }
    }

    /**
     * 组织后台审核拒绝 Skill 版本，不改变当前生效版本和可见范围。
     */
    public function rejectOrganizationVersion(RequestContext $requestContext, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        $this->skillVersionDomainService->reviewOrganizationSkillVersion(
            $dataIsolation,
            $id,
            ReviewStatus::REJECTED,
            $reviewRemark
        );
    }

    /**
     * 更新 Skill 市场排序值.
     */
    public function updateMarketSortOrder(RequestContext $requestContext, int $id, int $sortOrder): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        if (! $this->skillMarketDomainService->updateSortOrderById($id, $sortOrder)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }

        $market = $this->skillMarketDomainService->findByIds([$id])[$id] ?? null;
        if ($market !== null) {
            AsyncEventUtil::dispatch(new SkillMarketUpdatedEvent(
                (string) $id,
                $market->getOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            ));
        }
    }

    /**
     * 按传入字段部分更新 Skill 市场信息.
     */
    public function updateMarket(RequestContext $requestContext, int $id, UpdateSkillMarketRequestAdminDTO $requestDTO): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        if (! $requestDTO->hasUpdates()) {
            return;
        }

        $payload = $requestDTO->getUpdatePayload();
        $categoryIds = $payload['category_ids'] ?? null;
        unset($payload['category_ids']);

        $market = $this->skillMarketDomainService->findByIds([$id])[$id] ?? null;
        if ($market === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }

        Db::beginTransaction();
        try {
            if ($payload !== [] && ! $this->skillMarketDomainService->updateInfoById($id, $payload)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
            }
            if ($payload === [] && $this->skillMarketDomainService->findByIds([$id]) === []) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
            }
            if ($categoryIds !== null) {
                $this->skillCategoryRelationDomainService->replaceMarketCategories($market->getOrganizationCode(), $id, $categoryIds);
            }
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        AsyncEventUtil::dispatch(new SkillMarketUpdatedEvent(
            (string) $id,
            $market->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
    }

    /** @param int[] $categoryIds */
    public function updateMarketCategory(RequestContext $requestContext, int $id, array $categoryIds): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();
        $market = $this->skillMarketDomainService->findByIds([$id])[$id] ?? null;
        if ($market === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }
        Db::beginTransaction();
        try {
            $this->skillCategoryRelationDomainService->replaceMarketCategories($market->getOrganizationCode(), $id, $categoryIds);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        AsyncEventUtil::dispatch(new SkillMarketUpdatedEvent(
            (string) $id,
            $market->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
    }

    /**
     * 下架 Skill 市场条目.
     */
    public function offlineMarket(RequestContext $requestContext, int $id): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        Db::beginTransaction();
        try {
            $marketSkill = $this->skillMarketDomainService->offlineById($dataIsolation, $id);

            if ($marketSkill === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
            }

            $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $marketSkill->getSkillCode());

            $creatorId = $skillEntity->getCreatorId();

            if ($creatorId === '') {
                ExceptionBuilder::throw(
                    SuperMagicErrorCode::OperationFailed,
                    'common.operation_failed'
                );
            }

            $this->skillDomainService->deleteUserSkillOwnershipsExceptUser($dataIsolation, $marketSkill->getSkillCode(), $creatorId);

            $this->saveSkillVisibility(
                $dataIsolation,
                $marketSkill->getSkillCode(),
                VisibilityType::SPECIFIC,
                [$creatorId]
            );
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        AsyncEventUtil::dispatch(new SkillMarketOfflineEvent(
            (string) $id,
            $marketSkill->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
    }

    /**
     * 审核技能版本.
     */
    public function reviewSkillVersion(RequestContext $requestContext, int $id, ReviewSkillVersionRequestDTO $requestDTO): void
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        Db::beginTransaction();
        try {
            $this->skillVersionDomainService->reviewSkillVersion(
                $dataIsolation,
                $id,
                $requestDTO->getAction(),
                $requestDTO->getPublisherType(),
                $requestDTO->getReviewRemark()
            );

            if ($requestDTO->getAction() === ReviewStatus::APPROVED->value) {
                $this->syncApprovedVersionCategories($id);
            }
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        if ($requestDTO->getAction() === ReviewStatus::APPROVED->value) {
            $version = $this->skillVersionDomainService->findSkillVersionByIdWithoutOrganizationFilter($id);
            if ($version !== null) {
                try {
                    $skill = $this->skillDomainService->findSkillByCode($dataIsolation, $version->getCode());
                    $this->container->get(ReviewNotificationAppService::class)->publishSkillApproved($version, (string) ($skill?->getId() ?? ''));
                } catch (Throwable $throwable) {
                    $this->logger->warning('Skill approval notification failed', ['version_id' => $id, 'error' => $throwable->getMessage()]);
                }
            }
            $market = $version === null ? null : $this->skillMarketDomainService->findStoreSkillBySkillCode($version->getCode());
            if ($market !== null && $market->getId() !== null) {
                AsyncEventUtil::dispatch(new SkillMarketPublishedEvent(
                    (string) $market->getId(),
                    $market->getOrganizationCode(),
                    $dataIsolation->getCurrentUserId(),
                ));
            }
        }
    }

    /**
     * 将审核通过版本的分类关系同步到市场 Skill。
     *
     * 版本和市场记录分别维护分类关系，审核通过后需要以版本分类覆盖市场分类。
     */
    private function syncApprovedVersionCategories(int $versionId): void
    {
        $version = $this->skillVersionDomainService->findSkillVersionByIdWithoutOrganizationFilter($versionId);
        if ($version === null) {
            return;
        }

        $market = $this->skillMarketDomainService->findStoreSkillBySkillCode($version->getCode());
        $marketId = $market?->getId();
        if ($market === null || $marketId === null) {
            return;
        }

        $categoryIds = $this->skillCategoryRelationDomainService->getVersionCategoryIds($versionId);
        $this->skillCategoryRelationDomainService->replaceMarketCategories(
            $market->getOrganizationCode(),
            $marketId,
            $categoryIds
        );
    }

    /**
     * 将接口请求参数转换为领域查询条件。
     *
     * @param null|array<int, string> $publishTargetTypes
     * @param null|array<int, string> $excludeReviewStatuses
     */
    private function buildSkillVersionAdminQuery(
        QuerySkillVersionsRequestAdminDTO $requestDTO,
        ?array $publishTargetTypes,
        ?string $organizationCode,
        ?array $excludeReviewStatuses = null
    ): SkillVersionAdminQuery {
        $query = new SkillVersionAdminQuery();
        $query->setReviewStatus($requestDTO->getReviewStatus());
        $query->setPublishStatus($requestDTO->getPublishStatus());
        $query->setPublishTargetTypes($publishTargetTypes);
        $query->setSourceType($requestDTO->getSourceType());
        $query->setVersion($requestDTO->getVersion());
        $query->setPackageName($requestDTO->getPackageName());
        $query->setSkillName($requestDTO->getSkillName());
        $query->setOrganizationCode($organizationCode);
        $query->setStartTime($requestDTO->getStartTime());
        $query->setEndTime($requestDTO->getEndTime());
        $query->setOrderBy($requestDTO->getOrderBy());
        $query->setExcludeReviewStatuses($excludeReviewStatuses);

        return $query;
    }

    /**
     * 将审核通过的组织内发布范围同步到资源可见性表。
     */
    private function syncOrganizationSkillScope(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillVersionEntity $versionEntity
    ): void {
        $publishTargetType = $versionEntity->getPublishTargetType();

        $this->skillDomainService->deleteUserSkillOwnershipsExceptUser(
            $dataIsolation,
            $skillEntity->getCode(),
            $skillEntity->getCreatorId()
        );
        $this->skillMarketDomainService->updateAllPublishStatusBySkillCode(
            $skillEntity->getCode(),
            PublishStatus::OFFLINE->value
        );

        if ($publishTargetType === PublishTargetType::ORGANIZATION) {
            $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::ALL);
            return;
        }

        $publishTargetValue = $versionEntity->getPublishTargetValue();
        $userIds = array_values(array_unique(array_merge(
            [$skillEntity->getCreatorId()],
            $publishTargetValue?->getUserIds() ?? []
        )));

        $this->saveSkillVisibility(
            $dataIsolation,
            $skillEntity->getCode(),
            VisibilityType::SPECIFIC,
            $userIds,
            $publishTargetValue?->getDepartmentIds() ?? []
        );
    }

    private function saveSkillVisibility(
        SkillDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityType,
            $userIds,
            $departmentIds
        );
    }
}
