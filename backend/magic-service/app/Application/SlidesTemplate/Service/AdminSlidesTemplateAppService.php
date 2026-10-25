<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Event\SlidesTemplateBatchReindexRequestedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateCreatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateDeletedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateStatusUpdatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUpdatedEvent;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateColorExtractor;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateFavoriteDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateSearchTextBuilder;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\SlidesTemplate\DTO\Request\AdminQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\UpdateSlidesTemplateTagsRequest;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class AdminSlidesTemplateAppService extends AbstractSlidesTemplateAppService
{
    private const VECTOR_REINDEX_EVENT_BATCH_SIZE = 100;

    private const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'];

    private LoggerInterface $logger;

    public function __construct(
        SlidesTemplateDomainService $slidesTemplateDomainService,
        private readonly SlidesTemplateCategoryDomainService $slidesTemplateCategoryDomainService,
        private readonly SlidesTemplateTagDomainService $slidesTemplateTagDomainService,
        private readonly SlidesTemplateColorExtractor $slidesTemplateColorExtractor,
        private readonly SlidesTemplateFavoriteDomainService $slidesTemplateFavoriteDomainService,
        private readonly SlidesTemplateVectorIndexDomainService $slidesTemplateVectorIndexDomainService,
        ?LoggerFactory $loggerFactory = null,
    ) {
        parent::__construct($slidesTemplateDomainService);
        $this->logger = $loggerFactory?->get('slides-template-vector-sync') ?? new NullLogger();
    }

    /**
     * @return array{page: Page, total: int, list: SlidesTemplateEntity[], categories: array<string, SlidesTemplateCategoryEntity>}
     */
    public function queries(Authenticatable|BaseDataIsolation $authorization, AdminQuerySlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $query = $this->buildQuery($request->getKeyword(), $request->getCode(), $request->getCategoryCode(), $request->getStatus());
        $query->setTagCodes($request->getTagCodes());
        $query->setTagMatch($request->getTagMatch());
        $page = $this->createListPage($request->getPage(), $request->getPageSize());
        $page->setTotal(true);
        $result = $this->slidesTemplateDomainService->queries($dataIsolation, $query, $page);
        $this->resolveListImageUrls($result['list']);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, $result['list']);
        $categories = $this->resolveCategories($dataIsolation, $result['list']);

        return [
            'page' => $page,
            'total' => $result['total'],
            'list' => $result['list'],
            'categories' => $categories,
        ];
    }

    public function detail(Authenticatable|BaseDataIsolation $authorization, int|string $id): SlidesTemplateEntity
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $template = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
        $this->resolveAssetUrls([$template], includeTemplateFileUrl: false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$template]);

        return $template;
    }

    public function create(Authenticatable|BaseDataIsolation $authorization, SaveSlidesTemplateRequest $request): SlidesTemplateEntity
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $category = $this->findCategory($dataIsolation, $request->getCategoryCode());
        $this->assertTemplateFileIsArchive($request->getTemplateFileKey());
        $this->assertTemplateFileKeyHasPrivateUrl($dataIsolation->getCurrentOrganizationCode(), $request->getTemplateFileKey());
        $this->assertThumbnailFileKeyHasPublicUrl($dataIsolation->getCurrentOrganizationCode(), $request->getThumbnailFileKey());
        $tags = $this->slidesTemplateTagDomainService->findEnabledByCodes($dataIsolation, $request->getTagCodes());
        $template = $this->buildEntityFromRequest($request);
        $template->setCode($request->getCode() ?? SlidesTemplateEntity::generateNewCode());
        $template->setSourceType(SlidesTemplateSourceType::Custom);
        $template->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $template->setColors($this->extractThumbnailColors($dataIsolation, $template->getThumbnailFileKey()));
        $template->setCreatedUid($dataIsolation->getCurrentUserId());
        $template->setUpdatedUid($dataIsolation->getCurrentUserId());

        $template = Db::transaction(function () use ($dataIsolation, $request, $template, $category, $tags): SlidesTemplateEntity {
            $saved = $this->slidesTemplateDomainService->create($dataIsolation, $template, $category, $tags);
            if ($request->hasTagCodes()) {
                $this->slidesTemplateTagDomainService->syncTemplateTagsByCodes(
                    $dataIsolation,
                    (int) $saved->getId(),
                    $request->getTagCodes(),
                    $dataIsolation->getCurrentUserId()
                );
            }
            return $saved;
        });
        AsyncEventUtil::dispatch(new SlidesTemplateCreatedEvent(
            (string) $template->getId(),
            $template->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
        $this->resolveAssetUrls([$template], includeTemplateFileUrl: false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$template]);

        return $template;
    }

    public function update(Authenticatable|BaseDataIsolation $authorization, int|string $id, SaveSlidesTemplateRequest $request): SlidesTemplateEntity
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $category = $this->findCategory($dataIsolation, $request->getCategoryCode());
        $this->assertTemplateFileIsArchive($request->getTemplateFileKey());
        if ($request->hasTagCodes()) {
            $tags = $this->slidesTemplateTagDomainService->findEnabledByCodes($dataIsolation, $request->getTagCodes());
        }
        $existing = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
        $this->assertTemplateFileKeyHasPrivateUrl($existing->getOrganizationCode(), $request->getTemplateFileKey());
        $this->assertThumbnailFileKeyHasPublicUrl($existing->getOrganizationCode(), $request->getThumbnailFileKey());
        $template = $this->buildEntityFromRequest($request);
        $template->setId($existing->getId());
        $template->setOrganizationCode($existing->getOrganizationCode());
        $template->setCode($existing->getCode());
        $template->setSourceType($existing->getSourceType());
        $template->setColors($this->resolveUpdatedColors($dataIsolation, $existing, $template));
        $template->setBaseUsageCount($existing->getBaseUsageCount());
        $template->setActualUsageCount($existing->getActualUsageCount());
        $template->setCreatedUid($existing->getCreatedUid());
        $template->setUpdatedUid($dataIsolation->getCurrentUserId());

        if (! $request->hasTagCodes()) {
            $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$existing]);
            $tags = $existing->getTags();
        }
        $template = Db::transaction(function () use ($dataIsolation, $request, $template, $category, $tags): SlidesTemplateEntity {
            $saved = $this->slidesTemplateDomainService->update($dataIsolation, $template, $category, $tags);
            if ($request->hasTagCodes()) {
                $this->slidesTemplateTagDomainService->syncTemplateTagsByCodes(
                    $dataIsolation,
                    (int) $saved->getId(),
                    $request->getTagCodes(),
                    $dataIsolation->getCurrentUserId()
                );
            }
            return $saved;
        });
        AsyncEventUtil::dispatch(new SlidesTemplateUpdatedEvent(
            (string) $template->getId(),
            $template->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
        $this->resolveAssetUrls([$template], includeTemplateFileUrl: false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$template]);

        return $template;
    }

    public function updateTags(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $id,
        UpdateSlidesTemplateTagsRequest $request
    ): SlidesTemplateEntity {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $template = Db::transaction(function () use ($dataIsolation, $id, $request): SlidesTemplateEntity {
            $template = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
            $this->slidesTemplateTagDomainService->syncTemplateTagsByCodes(
                $dataIsolation,
                (int) $template->getId(),
                $request->getTagCodes(),
                $dataIsolation->getCurrentUserId()
            );
            $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$template]);
            $category = $template->getCategoryCode() === null
                ? null
                : $this->slidesTemplateCategoryDomainService->findByCodeOrFail($dataIsolation, $template->getCategoryCode());
            // Tag relation changes affect exact search, so persist the refreshed search text.
            $template->setSearchText(SlidesTemplateSearchTextBuilder::build($template, $category, $template->getTags()));
            return $this->slidesTemplateDomainService->saveSearchText($dataIsolation, $template);
        });
        AsyncEventUtil::dispatch(new SlidesTemplateUpdatedEvent(
            (string) $template->getId(),
            $template->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
        $this->resolveAssetUrls([$template], includeTemplateFileUrl: false);

        return $template;
    }

    public function updateStatus(Authenticatable|BaseDataIsolation $authorization, int|string $id, int $status): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $template = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
        $newStatus = SlidesTemplateStatus::from($status);

        $this->slidesTemplateDomainService->updateStatus(
            $dataIsolation,
            $id,
            $newStatus,
            $dataIsolation->getCurrentUserId()
        );
        AsyncEventUtil::dispatch(new SlidesTemplateStatusUpdatedEvent(
            (string) $template->getId(),
            $template->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $newStatus->value,
        ));
    }

    public function updateSort(Authenticatable|BaseDataIsolation $authorization, int|string $id, int $sort): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $this->slidesTemplateDomainService->updateSort($dataIsolation, $id, $sort, $dataIsolation->getCurrentUserId());
    }

    public function delete(Authenticatable|BaseDataIsolation $authorization, int|string $id): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        $template = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
        Db::transaction(function () use ($dataIsolation, $id): void {
            $template = $this->slidesTemplateDomainService->findByIdOrFail($dataIsolation, $id);
            $this->slidesTemplateTagDomainService->deleteTemplateTags($dataIsolation, (int) $template->getId());
            $this->slidesTemplateFavoriteDomainService->deleteBySlideTemplateCode($template->getCode());
            $this->slidesTemplateDomainService->delete($dataIsolation, $id);
        });
        AsyncEventUtil::dispatch(new SlidesTemplateDeletedEvent(
            (string) $template->getId(),
            $template->getOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
    }

    /** Run the complete vector-index reconciliation for the official templates. */
    public function reindexVectorIndex(
        Authenticatable|BaseDataIsolation $authorization,
        bool $forceReEmbedding = false,
    ): array {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->assertOfficialOrganization($dataIsolation);

        return $this->reconcileVectorIndex($dataIsolation, $forceReEmbedding);
    }

    /** Clean orphan points and queue every official template for reconciliation. */
    public function reconcileVectorIndex(
        SlidesTemplateDataIsolation $dataIsolation,
        bool $forceReEmbedding = false,
    ): array {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $reconcileSucceeded = true;
        $removed = 0;
        try {
            $removed = $this->slidesTemplateVectorIndexDomainService->removeOrphanPoints($dataIsolation, $organizationCode);
        } catch (Throwable $throwable) {
            $reconcileSucceeded = false;
            $this->logger->error('Slides template orphan vector cleanup failed', [
                'organization_code' => $organizationCode,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }

        $queued = 0;
        try {
            $result = $this->queueOfficialVectorReindex($dataIsolation, forceReEmbedding: $forceReEmbedding);
            $queued = $result['queued'] ?? 0;
        } catch (Throwable $throwable) {
            $reconcileSucceeded = false;
            $this->logger->error('Slides template vector reconciliation failed', [
                'organization_code' => $organizationCode,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }

        $this->logger->info('Slides template vector reconciliation finished', [
            'organization_code' => $organizationCode,
            'removed_orphans' => $removed,
            'queued' => $queued,
        ]);

        if ($reconcileSucceeded && $this->slidesTemplateVectorIndexDomainService->isVectorSearchEnabled()) {
            $this->slidesTemplateVectorIndexDomainService->markVectorIndexInitialized();
        }

        return ['removed_orphans' => $removed, 'queued' => $queued];
    }

    /** Queue a full official-template vector rebuild for an internal system event. */
    public function reindexOfficialVectorIndex(
        SlidesTemplateDataIsolation $dataIsolation,
        bool $forceReEmbedding = true,
    ): array {
        return $this->queueOfficialVectorReindex($dataIsolation, $forceReEmbedding);
    }

    private function queueOfficialVectorReindex(
        SlidesTemplateDataIsolation $dataIsolation,
        bool $forceReEmbedding,
    ): array {
        return $this->queueVectorReindex(
            $dataIsolation,
            $dataIsolation->getCurrentOrganizationCode(),
            [],
            null,
            [],
            'any',
            '0',
            self::VECTOR_REINDEX_EVENT_BATCH_SIZE,
            $forceReEmbedding,
        );
    }

    /** Queue vector rebuild batches for both HTTP requests and internal events. */
    private function queueVectorReindex(
        SlidesTemplateDataIsolation $dataIsolation,
        string $organizationCode,
        array $templateIds,
        ?string $categoryCode,
        array $tagCodes,
        string $tagMatch,
        string $afterId,
        int $batchSize,
        bool $force,
    ): array {
        if (! $this->slidesTemplateVectorIndexDomainService->isVectorSearchEnabled()) {
            $this->logger->info('Slides template full vector sync skipped because vector search is disabled', [
                'organization_code' => $organizationCode,
                'after_id' => $afterId,
                'force' => $force,
            ]);
            return ['task_id' => bin2hex(random_bytes(12)), 'queued' => 0, 'after_id' => $afterId];
        }

        $afterId = $force ? '0' : $afterId;
        $context = [
            'organization_code' => $organizationCode,
            'after_id' => $afterId,
            'force' => $force,
            'batch_size' => $batchSize,
            'template_ids_count' => count($templateIds),
            'category_code' => $categoryCode,
            'tag_codes' => $tagCodes,
            'tag_match' => $tagMatch,
        ];
        $this->logger->info('Slides template full vector sync started', $context);

        $queued = 0;
        $nextAfterId = $afterId;
        try {
            for ($page = 1;; ++$page) {
                $ids = $this->slidesTemplateDomainService->findIdsForSync(
                    $dataIsolation,
                    $organizationCode,
                    $templateIds,
                    $categoryCode,
                    $tagCodes,
                    $tagMatch,
                    $nextAfterId,
                    $batchSize,
                );
                $count = count($ids);
                if ($count === 0) {
                    break;
                }

                foreach (array_chunk($ids, self::VECTOR_REINDEX_EVENT_BATCH_SIZE) as $batchIds) {
                    AsyncEventUtil::dispatch(new SlidesTemplateBatchReindexRequestedEvent(
                        $batchIds,
                        $organizationCode,
                        $dataIsolation->getCurrentUserId(),
                        $force,
                    ));
                }

                $queued += $count;
                $nextAfterId = $ids[array_key_last($ids)];
                $this->logger->info('Slides template full vector sync page queued', $context + [
                    'page' => $page,
                    'page_queued' => $count,
                    'queued' => $queued,
                    'next_after_id' => $nextAfterId,
                ]);

                if ($count < $batchSize) {
                    break;
                }
            }
        } catch (Throwable $throwable) {
            $this->logger->error('Slides template full vector sync failed', $context + [
                'queued' => $queued,
                'next_after_id' => $nextAfterId,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }

        $this->logger->info('Slides template full vector sync queued', $context + [
            'queued' => $queued,
            'next_after_id' => $nextAfterId,
        ]);

        return ['task_id' => bin2hex(random_bytes(12)), 'queued' => $queued, 'after_id' => $nextAfterId];
    }

    private function assertOfficialOrganization(SlidesTemplateDataIsolation $dataIsolation): void
    {
        if (! $dataIsolation->isOfficialOrganization()) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::ONLY_OFFICIAL_ORGANIZATION_CAN_MANAGE);
        }
    }

    private function buildQuery(?string $keyword, ?string $code, ?string $categoryCode, ?int $status): SlidesTemplateQuery
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword($keyword);
        $query->setCode($code);
        $query->setCategoryCode($categoryCode);
        $query->setStatus($status);
        return $query;
    }

    private function buildEntityFromRequest(SaveSlidesTemplateRequest $request): SlidesTemplateEntity
    {
        $template = new SlidesTemplateEntity();
        $template->setCategoryCode($request->getCategoryCode());
        $template->setLabel($request->getLabel());
        $template->setDescription($request->getDescription());
        $template->setThumbnailFileKey($request->getThumbnailFileKey());
        $template->setCollageFileKey($request->getCollageFileKey());
        $template->setPreviewImageFileKeys($request->getPreviewImageFileKeys());
        $template->setTemplateFileKey($request->getTemplateFileKey());
        $template->setPreviewUrl($request->getPreviewUrl());
        $template->setStatus($request->getStatus());
        $template->setSort($request->getSort());
        return $template;
    }

    private function findCategory(
        SlidesTemplateDataIsolation $dataIsolation,
        ?string $categoryCode
    ): ?SlidesTemplateCategoryEntity {
        if ($categoryCode === null) {
            return null;
        }

        return $this->slidesTemplateCategoryDomainService->findByCodeOrFail($dataIsolation, $categoryCode);
    }

    private function assertTemplateFileIsArchive(string $templateFileKey): void
    {
        $extension = strtolower(pathinfo($templateFileKey, PATHINFO_EXTENSION));
        if (! in_array($extension, self::ARCHIVE_EXTENSIONS, true)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::VALIDATE_FAILED, 'slides_template.template_file_must_be_archive');
        }
    }

    private function assertThumbnailFileKeyHasPublicUrl(string $organizationCode, string $thumbnailFileKey): void
    {
        if ($thumbnailFileKey === '') {
            return;
        }

        $fileLinks = $this->getPublicFileLinks($organizationCode, [$thumbnailFileKey]);
        $fileLink = $fileLinks[$thumbnailFileKey] ?? null;
        if (! $fileLink instanceof FileLink || $fileLink->getUrl() === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::VALIDATE_FAILED, 'slides_template.thumbnail_file_url_generate_failed');
        }
    }

    private function assertTemplateFileKeyHasPrivateUrl(string $organizationCode, string $templateFileKey): void
    {
        if ($templateFileKey === '') {
            return;
        }

        $fileLinks = $this->getPrivateFileLinks($organizationCode, [$templateFileKey]);
        $fileLink = $fileLinks[$templateFileKey] ?? null;
        if (! $fileLink instanceof FileLink || $fileLink->getUrl() === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::VALIDATE_FAILED, 'slides_template.template_file_url_generate_failed');
        }
    }

    private function resolveUpdatedColors(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateEntity $existing,
        SlidesTemplateEntity $template
    ): array {
        if ($existing->getThumbnailFileKey() === $template->getThumbnailFileKey()) {
            return $existing->getColors();
        }

        return $this->extractThumbnailColors($dataIsolation, $template->getThumbnailFileKey());
    }

    /**
     * @return string[]
     */
    private function extractThumbnailColors(SlidesTemplateDataIsolation $dataIsolation, string $thumbnailFileKey): array
    {
        if ($thumbnailFileKey === '') {
            return [];
        }

        try {
            $fileLinks = $this->getPublicFileLinks($dataIsolation->getCurrentOrganizationCode(), [$thumbnailFileKey]);
            $fileLink = $fileLinks[$thumbnailFileKey] ?? null;
            if (! $fileLink instanceof FileLink || $fileLink->getUrl() === '') {
                return [];
            }

            $context = stream_context_create([
                'http' => ['timeout' => 5],
                'https' => ['timeout' => 5],
            ]);
            $content = @file_get_contents($fileLink->getUrl(), false, $context);
            if (! is_string($content) || $content === '') {
                return [];
            }

            return $this->slidesTemplateColorExtractor->extractColors($content);
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @param SlidesTemplateEntity[] $templates
     * @return array<string, SlidesTemplateCategoryEntity>
     */
    private function resolveCategories(SlidesTemplateDataIsolation $dataIsolation, array $templates): array
    {
        $categoryCodes = [];
        foreach ($templates as $template) {
            $categoryCode = $template->getCategoryCode();
            if ($categoryCode !== null) {
                $categoryCodes[$categoryCode] = $categoryCode;
            }
        }

        if ($categoryCodes === []) {
            return [];
        }

        $categories = $this->slidesTemplateCategoryDomainService->findByCodes($dataIsolation, array_values($categoryCodes));
        $categoryMap = [];
        foreach ($categories as $category) {
            $categoryMap[$category->getCode()] = $category;
        }
        return $categoryMap;
    }
}
