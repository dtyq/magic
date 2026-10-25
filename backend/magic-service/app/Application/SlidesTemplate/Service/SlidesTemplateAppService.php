<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Domain\Audit\ResourceAccess\Service\ResourceAccessLogDomainService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateCodeAvailability;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSearchType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Event\SlidesTemplateCreatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUpdatedEvent;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateFavoriteDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\PublishSlidesTemplateFromProjectRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\QueryFavoriteSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\QueryUsedSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveUserSlidesTemplateRequest;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class SlidesTemplateAppService extends AbstractSlidesTemplateAppService
{
    private const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'];

    private const FEATURED_TAG_CODE = 'featured';

    private LoggerInterface $logger;

    public function __construct(
        SlidesTemplateDomainService $slidesTemplateDomainService,
        private readonly SlidesTemplateTagDomainService $slidesTemplateTagDomainService,
        private readonly SlidesTemplateCategoryDomainService $slidesTemplateCategoryDomainService,
        private readonly SlidesTemplateFavoriteDomainService $slidesTemplateFavoriteDomainService,
        private readonly ResourceAccessLogDomainService $resourceAccessLogDomainService,
        private readonly SlidesTemplateProjectExportService $slidesTemplateProjectExportService,
        private readonly SlidesTemplateVectorIndexDomainService $slidesTemplateVectorIndexDomainService,
        ?LoggerFactory $loggerFactory = null,
    ) {
        parent::__construct($slidesTemplateDomainService);
        $this->logger = $loggerFactory?->get('slides-template-search') ?? new NullLogger();
    }

    /** @return array{page: Page, list: SlidesTemplateEntity[], favorite_codes: array<string, bool>} */
    public function queries(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $query = $this->createPublicQuery($request);
        $page = $this->createListPage($request->getPage(), $request->getPageSize());
        $page->setTotal(false);
        $result = $this->queryByConfiguredSearch($dataIsolation, $query, $page);
        $this->slidesTemplateTagDomainService->fillTemplateTags(
            $dataIsolation,
            $result['list'],
            SlidesTemplateTagStatus::Enabled,
            [self::FEATURED_TAG_CODE],
        );
        $this->resolveListImageUrls($result['list']);

        return [
            'page' => $page,
            'list' => $result['list'],
            'favorite_codes' => $this->getFavoriteCodes($dataIsolation, $query),
        ];
    }

    public function count(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $query = $this->createPublicQuery($request);
        $query->setScope(SlidesTemplateQueryScope::Official);
        $query->setStatus(SlidesTemplateStatus::Enabled->value);
        return $this->slidesTemplateDomainService->getCount($dataIsolation, $query);
    }

    public function detail(Authenticatable|BaseDataIsolation $authorization, string $code): SlidesTemplateEntity
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $template = $this->slidesTemplateDomainService->findByCodeOrFail($dataIsolation, $code);
        $this->slidesTemplateDomainService->assertUserAccessible($dataIsolation, $template);
        $this->resolveAssetUrls([$template], includeTemplateFileUrl: false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$template]);
        return $template;
    }

    public function save(Authenticatable|BaseDataIsolation $authorization, SaveUserSlidesTemplateRequest $request): SlidesTemplateEntity
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $this->assertOfficialCategory($dataIsolation, $request->getCategoryCode());
        $this->assertOfficialTags($dataIsolation, $request->getTagCodes());
        $category = $request->getCategoryCode() === null
            ? null
            : $this->slidesTemplateCategoryDomainService->findByCodeOrFail($dataIsolation, $request->getCategoryCode());
        $tags = $this->slidesTemplateTagDomainService->findEnabledByCodes($dataIsolation, $request->getTagCodes());
        $this->assertTemplateFileIsArchive($request->getTemplateFileKey());
        $this->assertPrivateFileExists($dataIsolation->getCurrentOrganizationCode(), $request->getTemplateFileKey());
        $this->assertPublicFilesExist($dataIsolation->getCurrentOrganizationCode(), [
            $request->getThumbnailFileKey(),
            $request->getCollageFileKey(),
            ...$request->getPreviewImageFileKeys(),
        ]);

        $existingTemplate = $request->getCode() === null
            ? null
            : $this->slidesTemplateDomainService->findGloballyByCode($request->getCode());
        $entity = new SlidesTemplateEntity();
        $entity->setCode($request->getCode() ?? '')
            ->setCategoryCode($request->getCategoryCode())
            ->setLabel($request->getLabel())
            ->setDescription($request->getDescription())
            ->setThumbnailFileKey($request->getThumbnailFileKey())
            ->setCollageFileKey($request->getCollageFileKey())
            ->setPreviewImageFileKeys($request->getPreviewImageFileKeys())
            ->setTemplateFileKey($request->getTemplateFileKey())
            ->setPreviewUrl($request->getPreviewUrl());
        $saved = $this->slidesTemplateDomainService->saveUserTemplate(
            $dataIsolation,
            $entity,
            $request->hasStatus() ? SlidesTemplateStatus::from($request->getStatus()) : null,
            $request->hasTagCodes() ? $request->getTagCodes() : null,
            $category,
            $tags,
        );
        // Publish the business event only after the database write succeeds.
        if ($existingTemplate === null) {
            AsyncEventUtil::dispatch(new SlidesTemplateCreatedEvent(
                (string) $saved->getId(),
                $saved->getOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            ));
        } else {
            AsyncEventUtil::dispatch(new SlidesTemplateUpdatedEvent(
                (string) $saved->getId(),
                $saved->getOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            ));
        }
        $this->resolveAssetUrls([$saved], false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$saved]);
        return $saved;
    }

    public function publishFromProject(
        Authenticatable|BaseDataIsolation $authorization,
        PublishSlidesTemplateFromProjectRequest $request
    ): SlidesTemplateEntity {
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::USER_TEMPLATE_ACCESS_DENIED);
        }

        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $exportId = bin2hex(random_bytes(12));
        $payload = $this->slidesTemplateProjectExportService->publishFromProjectWorkspace(
            $authorization,
            $dataIsolation,
            $request->getProjectId(),
            $request->getDirectoryId(),
            $request->getCode(),
            $exportId
        );
        $previousTemplate = null;
        try {
            $previousTemplate = $this->slidesTemplateDomainService->findGloballyByCode($payload['code']);
            if ($previousTemplate !== null) {
                $this->slidesTemplateDomainService->assertOwnedByUser($dataIsolation, $previousTemplate);
            }
            $this->assertOfficialCategory($dataIsolation, $payload['category_code']);
            $this->assertOfficialTags($dataIsolation, $payload['tag_codes']);
            $category = $payload['category_code'] === null
                ? null
                : $this->slidesTemplateCategoryDomainService->findByCodeOrFail($dataIsolation, $payload['category_code']);
            $tags = $this->slidesTemplateTagDomainService->findEnabledByCodes($dataIsolation, $payload['tag_codes']);
            $this->assertTemplateFileIsArchive($payload['template_file_key']);
            $this->assertPrivateFileExists($dataIsolation->getCurrentOrganizationCode(), $payload['template_file_key']);
            $this->assertPublicFilesExist($dataIsolation->getCurrentOrganizationCode(), [$payload['thumbnail_file_key'], $payload['collage_file_key'], ...$payload['preview_image_file_keys']]);

            $entity = new SlidesTemplateEntity();
            $entity->setCode($payload['code'])->setCategoryCode($payload['category_code'])->setLabel($payload['label'])->setDescription($payload['description'])->setThumbnailFileKey($payload['thumbnail_file_key'])->setCollageFileKey($payload['collage_file_key'])->setPreviewImageFileKeys($payload['preview_image_file_keys'])->setTemplateFileKey($payload['template_file_key'])->setProjectId($payload['project_id'])->setProjectDirectoryId($payload['project_directory_id']);
            $saved = $this->slidesTemplateDomainService->saveUserTemplate(
                $dataIsolation,
                $entity,
                null,
                $payload['tag_codes'],
                $category,
                $tags,
            );
            if ($previousTemplate === null) {
                AsyncEventUtil::dispatch(new SlidesTemplateCreatedEvent(
                    (string) $saved->getId(),
                    $saved->getOrganizationCode(),
                    $dataIsolation->getCurrentUserId(),
                ));
            } else {
                AsyncEventUtil::dispatch(new SlidesTemplateUpdatedEvent(
                    (string) $saved->getId(),
                    $saved->getOrganizationCode(),
                    $dataIsolation->getCurrentUserId(),
                ));
            }
        } catch (Throwable $throwable) {
            $this->slidesTemplateProjectExportService->cleanupExportedFiles($dataIsolation, $payload, $exportId);
            throw $throwable;
        }
        if ($previousTemplate !== null) {
            $this->slidesTemplateProjectExportService->cleanupPreviousTemplateDirectory(
                $dataIsolation,
                $previousTemplate,
                $exportId,
            );
        }
        $this->resolveAssetUrls([$saved], false);
        $this->slidesTemplateTagDomainService->fillTemplateTags($dataIsolation, [$saved]);
        return $saved;
    }

    /** @return array{page: Page, list: SlidesTemplateEntity[], favorite_codes: array<string, bool>} */
    public function favorites(Authenticatable|BaseDataIsolation $authorization, QueryFavoriteSlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $query = $this->createPublicQuery($request);
        $query->setScope(SlidesTemplateQueryScope::All);
        $page = $this->createListPage($request->getPage(), $request->getPageSize());
        $page->setTotal(false);
        $result = $this->slidesTemplateDomainService->queriesFavorites($dataIsolation, $query, $page);
        $this->resolveListImageUrls($result['list']);
        return ['page' => $page, 'list' => $result['list'], 'favorite_codes' => $this->codes($result['list'])];
    }

    /** @return array{page: Page, list: SlidesTemplateEntity[], favorite_codes: array<string, bool>, latest_used_at_by_code: array<string, null|string>} */
    public function used(Authenticatable|BaseDataIsolation $authorization, QueryUsedSlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $page = $this->createListPage($request->getPage(), $request->getPageSize());
        $page->setTotal(false);
        $usage = $this->resourceAccessLogDomainService->queriesRecentlyUsedResources(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            'slides_template',
            'use',
            $page,
            false
        );
        $codes = array_column($usage['list'], 'resource_code');
        $templates = $this->slidesTemplateDomainService->findByCodes($dataIsolation, $codes);
        $templatesByCode = [];
        foreach ($templates as $template) {
            $templatesByCode[$template->getCode()] = $template;
        }
        $list = [];
        $latestUsedAtByCode = [];
        foreach ($usage['list'] as $usageItem) {
            $template = $templatesByCode[$usageItem['resource_code']] ?? null;
            if ($template instanceof SlidesTemplateEntity) {
                $list[] = $template;
                $latestUsedAtByCode[$template->getCode()] = $usageItem['latest_used_at'];
            }
        }
        $this->resolveListImageUrls($list);
        return [
            'page' => $page,
            'list' => $list,
            'favorite_codes' => $this->getFavoriteCodes($dataIsolation, new SlidesTemplateQuery()),
            'latest_used_at_by_code' => $latestUsedAtByCode,
        ];
    }

    public function availability(Authenticatable|BaseDataIsolation $authorization, string $code): SlidesTemplateCodeAvailability
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        return $this->slidesTemplateDomainService->getCodeAvailabilityForUser($dataIsolation, $code);
    }

    public function favorite(Authenticatable|BaseDataIsolation $authorization, string $code): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $template = $this->slidesTemplateDomainService->findByCodeOrFail($dataIsolation, $code);
        $this->slidesTemplateDomainService->assertUserAccessible($dataIsolation, $template);
        $this->slidesTemplateFavoriteDomainService->favorite($dataIsolation, $code);
    }

    public function unfavorite(Authenticatable|BaseDataIsolation $authorization, string $code): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $this->slidesTemplateFavoriteDomainService->unfavorite($dataIsolation, $code);
    }

    public function deleteUserTemplate(Authenticatable|BaseDataIsolation $authorization, string $code): void
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);

        Db::transaction(function () use ($dataIsolation, $code): void {
            $template = $this->slidesTemplateDomainService->findByCodeOrFail($dataIsolation, $code);
            $this->slidesTemplateDomainService->assertOwnedByUser($dataIsolation, $template);
            $this->slidesTemplateTagDomainService->deleteTemplateTags($dataIsolation, (int) $template->getId());
            $this->slidesTemplateFavoriteDomainService->deleteBySlideTemplateCode($template->getCode());
            $this->slidesTemplateDomainService->delete($dataIsolation, (int) $template->getId());
        });
    }

    private function createPublicQuery(PublicQuerySlidesTemplateRequest $request): SlidesTemplateQuery
    {
        $query = new SlidesTemplateQuery();
        $query->setScope($request->getScope());
        $query->setKeyword($request->getKeyword());
        $query->setSearchType($request->getSearchType());
        $query->setCode($request->getCode());
        $query->setCategoryCode($request->getCategoryCode());
        $query->setTagCodes($request->getTagCodes());
        $query->setTagMatch(SlidesTemplateTagMatch::tryFrom($request->getTagMatch()) ?? SlidesTemplateTagMatch::Any);
        if ($query->getScope() === SlidesTemplateQueryScope::Official) {
            $query->setStatus(SlidesTemplateStatus::Enabled->value);
        }
        return $query;
    }

    private function getFavoriteCodes(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): array
    {
        $page = Page::createNoPage();
        $result = $this->slidesTemplateDomainService->queriesFavorites($dataIsolation, clone $query, $page);
        return $this->codes($result['list']);
    }

    /** Select vector or database search without introducing an AppService-to-AppService call. */
    private function queryByConfiguredSearch(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateQuery $query,
        Page $page,
    ): array {
        $keyword = $query->getKeyword();
        if ($query->getSearchType() !== SlidesTemplateSearchType::Vector
            || $keyword === null
            || trim($keyword) === ''
            || ! $this->slidesTemplateVectorIndexDomainService->isVectorSearchReady()) {
            return $this->slidesTemplateDomainService->queries($dataIsolation, $query, $page);
        }

        if (! $this->slidesTemplateVectorIndexDomainService->isAvailable()) {
            $this->logger->info('Slides template vector search fallback', ['reason' => 'qdrant_unavailable']);
            return $this->slidesTemplateDomainService->queries($dataIsolation, $query, $page);
        }

        try {
            return ['total' => 0, 'list' => $this->slidesTemplateVectorIndexDomainService->search($dataIsolation, $query, $page)];
        } catch (Throwable $throwable) {
            $this->logger->warning('Slides template vector search fallback', [
                'reason' => 'exception',
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            return $this->slidesTemplateDomainService->queries($dataIsolation, $query, $page);
        }
    }

    private function codes(array $templates): array
    {
        $codes = [];
        foreach ($templates as $template) {
            if ($template instanceof SlidesTemplateEntity) {
                $codes[$template->getCode()] = true;
            }
        }
        return $codes;
    }

    private function assertOfficialCategory(SlidesTemplateDataIsolation $dataIsolation, ?string $code): void
    {
        if ($code === null) {
            return;
        }
        $category = $this->slidesTemplateCategoryDomainService->findByCodeOrFail($dataIsolation, $code);
        if (! in_array($category->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::CATEGORY_NOT_OFFICIAL);
        }
    }

    private function assertOfficialTags(SlidesTemplateDataIsolation $dataIsolation, array $codes): void
    {
        if ($codes === []) {
            return;
        }
        $tags = $this->slidesTemplateTagDomainService->findEnabledByCodes($dataIsolation, $codes);
        foreach ($tags as $tag) {
            if (! in_array($tag->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes(), true)) {
                ExceptionBuilder::throw(SlidesTemplateErrorCode::TAG_NOT_OFFICIAL);
            }
        }
    }

    private function assertTemplateFileIsArchive(string $fileKey): void
    {
        if (! in_array(strtolower(pathinfo($fileKey, PATHINFO_EXTENSION)), self::ARCHIVE_EXTENSIONS, true)) {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::VALIDATE_FAILED, 'slides_template.template_file_must_be_archive');
        }
    }

    private function assertPrivateFileExists(string $organizationCode, string $fileKey): void
    {
        $links = $this->getPrivateFileLinks($organizationCode, [$fileKey]);
        if (! (($links[$fileKey] ?? null) instanceof FileLink) || trim($links[$fileKey]->getUrl()) === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::TEMPLATE_FILE_ACCESS_DENIED);
        }
    }

    private function assertPublicFilesExist(string $organizationCode, array $fileKeys): void
    {
        $fileKeys = array_values(array_unique(array_filter(
            $fileKeys,
            static fn (?string $fileKey): bool => $fileKey !== null && $fileKey !== ''
        )));
        $links = $this->getPublicFileLinks($organizationCode, $fileKeys);
        foreach ($fileKeys as $fileKey) {
            $fileLink = $links[$fileKey] ?? null;
            if (! $fileLink instanceof FileLink || trim($fileLink->getUrl()) === '') {
                ExceptionBuilder::throw(SlidesTemplateErrorCode::VALIDATE_FAILED, 'slides_template.thumbnail_file_url_generate_failed');
            }
        }
    }
}
