<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Service;

use App\Domain\Kernel\Service\AbstractVectorIndexDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRelationRepositoryInterface;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use RuntimeException;

final class SlidesTemplateVectorIndexDomainService extends AbstractVectorIndexDomainService
{
    public function __construct(
        private readonly SlidesTemplateRepositoryInterface $slidesTemplateRepository,
        private readonly SlidesTemplateTagRelationRepositoryInterface $slidesTemplateTagRelationRepository,
        VectorStoreInterface $vectorStore,
        EmbeddingGeneratorInterface $embeddingGenerator,
        Redis $redis,
        LoggerFactory $loggerFactory,
    ) {
        parent::__construct($vectorStore, $embeddingGenerator, $redis, $loggerFactory);
    }

    /** Remove Qdrant points that no longer represent enabled official templates. */
    public function removeOrphanPoints(SlidesTemplateDataIsolation $dataIsolation, string $organizationCode): int
    {
        $collectionName = $this->collectionName();
        if ($this->vectorStore->getCollection($collectionName) === null) {
            return 0;
        }

        $removed = 0;
        $offset = null;
        while (true) {
            $page = $this->vectorStore->scrollPoints($collectionName, 200, $offset);
            $pointIds = array_values(array_unique(array_map(
                static fn ($point): string => (string) $point->id,
                $page['points'],
            )));

            if ($pointIds !== []) {
                $existingIds = [];
                foreach ($this->slidesTemplateRepository->findVisibleByIds($dataIsolation, $pointIds) as $template) {
                    if ($template->getOwnerType()->isOfficial()
                        && $template->getOrganizationCode() === $organizationCode) {
                        $existingIds[(string) $template->getId()] = true;
                    }
                }

                $orphanIds = array_values(array_filter(
                    $pointIds,
                    static fn (string $pointId): bool => ! isset($existingIds[$pointId]),
                ));
                if ($orphanIds !== []) {
                    $this->vectorStore->removePoints($collectionName, $orphanIds);
                    $removed += count($orphanIds);
                    $this->logger->info('Slides template orphan vector points removed', [
                        'collection_name' => $collectionName,
                        'point_ids' => $orphanIds,
                        'batch_removed' => count($orphanIds),
                        'total_removed' => $removed,
                    ]);
                }
            }

            $nextOffset = $page['next_page_offset'];
            if ($nextOffset === null || $nextOffset === $offset || $pointIds === []) {
                break;
            }
            $offset = $nextOffset;
        }

        return $removed;
    }

    /** Read the latest template state and apply the smallest required index update. */
    public function sync(
        SlidesTemplateDataIsolation $dataIsolation,
        string $resourceId,
        string $operatorId,
        bool $forceReEmbedding = false,
    ): void {
        $template = $this->slidesTemplateRepository->findById($dataIsolation, $resourceId);
        if ($template === null || ! $template->getStatus()->isEnabled()) {
            $this->logger->info('Slides template vector sync skipped and stale point removed', [
                'resource_type' => 'slides_template',
                'resource_id' => $resourceId,
                'organization_code' => $template?->getOrganizationCode() ?: $dataIsolation->getCurrentOrganizationCode(),
                'operator_id' => $operatorId,
                'reason' => $template === null ? 'template_not_found' : 'template_disabled',
            ]);
            $this->removePoint($resourceId);
            return;
        }

        if (! $template->getOwnerType()->isOfficial()) {
            $this->logger->info('Slides template vector sync skipped because template owner is not official', [
                'resource_type' => 'slides_template',
                'resource_id' => $resourceId,
                'organization_code' => $template->getOrganizationCode(),
                'operator_id' => $operatorId,
                'owner_type' => $template->getOwnerType()->value,
            ]);
            $this->removePoint($resourceId);
            return;
        }

        if (! $this->isVectorSearchEnabled()) {
            $this->logger->info('Slides template vector sync skipped because vector search is disabled', [
                'resource_type' => 'slides_template',
                'resource_id' => $resourceId,
                'organization_code' => $template->getOrganizationCode(),
                'operator_id' => $operatorId,
            ]);
            $this->removePoint($resourceId);
            return;
        }

        $collectionName = $this->collectionName();
        $tagMap = $this->slidesTemplateTagRelationRepository->findTagsByTemplateIds(
            $dataIsolation,
            [(int) $template->getId()],
            SlidesTemplateTagStatus::Enabled->value,
        );
        $template->setTags($tagMap[(int) $template->getId()] ?? []);
        $payload = $this->buildPayload($template, $template->getTags());
        $searchText = SlidesTemplateSearchTextBuilder::buildSemanticText($template, tags: $template->getTags());
        if ($searchText === '') {
            throw new RuntimeException('Slides template semantic text is empty');
        }
        $payload['search_text'] = $searchText;
        $this->logger->info('Slides template semantic text prepared', [
            'resource_id' => $resourceId,
            'search_text' => $searchText,
        ]);

        $existingPoint = $this->vectorStore->getPoint($collectionName, (string) $template->getId());
        if ($existingPoint !== null) {
            // Re-embed only when search text changes or a model migration forces it.
            if ($forceReEmbedding || ($existingPoint->payload['search_text'] ?? null) !== $searchText) {
                $embedding = $this->generateEmbedding(
                    $dataIsolation,
                    $searchText,
                    $operatorId,
                    $template,
                    $forceReEmbedding ? 'force_re_embedding' : 'search_text_changed',
                );
                $this->ensureCollection($collectionName, $embedding, $forceReEmbedding);
                $this->vectorStore->storePoint($collectionName, (string) $template->getId(), $embedding, $payload);
                return;
            }

            // Keep the existing vector and refresh payload metadata when text is unchanged.
            $this->logger->info('Slides template vector payload update without re-embedding', [
                'resource_id' => $resourceId,
                'reason' => 'search_text_unchanged',
            ]);
            $this->vectorStore->updatePayload($collectionName, (string) $template->getId(), $payload);
            return;
        }

        // A missing point may indicate a new template or an uncreated collection.
        $embedding = $this->generateEmbedding($dataIsolation, $searchText, $operatorId, $template, 'point_not_found');
        $this->ensureCollection($collectionName, $embedding, $forceReEmbedding);
        $this->vectorStore->storePoint($collectionName, (string) $template->getId(), $embedding, $payload);
        $this->logger->info('Slides template vector stored', ['resource_id' => $resourceId]);
    }

    /** Retrieve Qdrant candidates, then apply authoritative MySQL visibility checks. */
    public function search(
        SlidesTemplateDataIsolation $dataIsolation,
        SlidesTemplateQuery $query,
        Page $page,
    ): array {
        if ($query->getKeyword() === null) {
            return [];
        }

        // Normalize equivalent input so whitespace and case variants share one cache entry.
        $keyword = $this->normalizeKeyword($query->getKeyword());
        if ($keyword === '') {
            return [];
        }

        $embedding = $this->embedText(
            $dataIsolation,
            $keyword,
            [
                'business_params' => [
                    'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'business_id' => 'search:' . md5($keyword),
                    'source_id' => SourceId::SEMANTIC_SEARCH,
                ],
            ],
        );
        if ($embedding === []) {
            return [];
        }

        $this->assertEmbeddingDimension($this->collectionName(), $embedding);

        $pageSize = $page->getPageNum();
        $matchedOffset = $page->getSliceStart();
        $candidateOffset = 0;
        $matchedCount = 0;
        $results = [];
        $seenIds = [];
        $filter = $this->buildFilter($dataIsolation, $query);
        $scoreThreshold = (float) config('vector_index.resources.slides_template.score_threshold', 0.2);

        // Qdrant paginates candidates; scan until the requested page is filled after MySQL filtering.
        do {
            $points = $this->vectorStore->searchPoints(
                $this->collectionName(),
                $embedding,
                $pageSize,
                $scoreThreshold,
                $filter,
                $candidateOffset,
            );
            if ($points === []) {
                break;
            }
            $candidateOffset += count($points);

            $ids = [];
            foreach ($points as $point) {
                $id = (string) $point->id;
                if (! isset($seenIds[$id])) {
                    $seenIds[$id] = true;
                    $ids[] = $id;
                }
            }
            if ($ids === []) {
                continue;
            }

            // Qdrant ranks candidates; MySQL confirms organization scope and enabled status.
            $templates = $this->slidesTemplateRepository->findVisibleByIds($dataIsolation, $ids);
            $templatesById = [];
            foreach ($templates as $template) {
                $templatesById[(string) $template->getId()] = $template;
            }

            // Restore Qdrant similarity order after the repository lookup.
            foreach ($ids as $id) {
                $template = $templatesById[$id] ?? null;
                if (! $template instanceof SlidesTemplateEntity) {
                    continue;
                }
                if ($matchedCount++ < $matchedOffset) {
                    continue;
                }
                $results[] = $template;
                if (count($results) >= $pageSize) {
                    break 2;
                }
            }
        } while (count($points) === $pageSize);

        return $results;
    }

    protected function collectionName(): string
    {
        return (string) config('vector_index.resources.slides_template.collection', 'slides_templates');
    }

    protected function businessLabel(): string
    {
        return 'Slides template';
    }

    protected function initializedKey(): string
    {
        return 'vector_index:initialized:slides_template';
    }

    /** Generate a vector for a new point or changed search text. */
    private function generateEmbedding(
        SlidesTemplateDataIsolation $dataIsolation,
        string $searchText,
        string $operatorId,
        SlidesTemplateEntity $template,
        string $reason,
    ): array {
        $this->logger->info('Slides template embedding generation started', [
            'resource_id' => (string) $template->getId(),
            'reason' => $reason,
            'forced' => $reason === 'force_re_embedding',
            'text_length' => mb_strlen($searchText),
        ]);
        $embedding = $this->embedText(
            $dataIsolation,
            $searchText,
            ['business_params' => [
                'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $operatorId,
                'business_id' => 'template:' . $template->getId(),
                'source_id' => SourceId::SLIDES_TEMPLATE_VECTOR_SYNC,
            ]],
        );
        if ($embedding === []) {
            throw new RuntimeException('Slides template embedding is empty');
        }
        $this->logger->info('Slides template embedding generation completed', [
            'resource_id' => (string) $template->getId(),
            'vector_size' => count($embedding),
        ]);

        return $embedding;
    }

    /** @param array<int, mixed> $tags */
    private function buildPayload(SlidesTemplateEntity $template, array $tags): array
    {
        return [
            'template_id' => (string) $template->getId(),
            'template_code' => $template->getCode(),
            'organization_code' => $template->getOrganizationCode(),
            'owner_type' => $template->getOwnerType()->value,
            'owner_id' => $template->getOwnerId() ?? '',
            'category_code' => $template->getCategoryCode() ?? '',
            'tag_codes' => array_values(array_map(
                static fn ($tag): string => $tag->getCode(),
                array_filter($tags, static fn ($tag): bool => $tag instanceof SlidesTemplateTagEntity),
            )),
            'status' => $template->getStatus()->value,
            'updated_at' => $template->getUpdatedAt() ?? '',
        ];
    }

    /** Convert public query conditions into Qdrant filters. */
    private function buildFilter(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): array
    {
        $must = [];
        if ($query->getCode() !== null) {
            $must[] = ['key' => 'template_code', 'value' => $query->getCode()];
        }
        if ($query->getCategoryCode() !== null) {
            $must[] = ['key' => 'category_code', 'value' => $query->getCategoryCode()];
        }
        if ($query->getStatus() !== null) {
            $must[] = ['key' => 'status', 'value' => $query->getStatus()];
        }
        if ($query->getTagCodes() !== []) {
            if ($query->getTagMatch() === SlidesTemplateTagMatch::All) {
                foreach ($query->getTagCodes() as $tagCode) {
                    $must[] = ['key' => 'tag_codes', 'value' => $tagCode];
                }
            } else {
                $must[] = ['key' => 'tag_codes', 'any' => $query->getTagCodes()];
            }
        }

        if ($query->getOwnerType() !== null) {
            $must[] = ['key' => 'owner_type', 'value' => $query->getOwnerType()->value];
            if ($query->getOwnerId() !== null) {
                $must[] = ['key' => 'owner_id', 'value' => $query->getOwnerId()];
            }
        } elseif ($query->getScope() === SlidesTemplateQueryScope::Official) {
            $must[] = ['key' => 'organization_code', 'any' => $dataIsolation->getOfficialOrganizationCodes()];
            $must[] = ['key' => 'status', 'value' => SlidesTemplateStatus::Enabled->value];
        } elseif ($query->getScope() === SlidesTemplateQueryScope::User) {
            $must = [...$must, ...$this->currentUserConditions($dataIsolation)];
        } else {
            return [
                'must' => [...$must, [
                    'should' => [
                        ['must' => [
                            ['key' => 'organization_code', 'any' => $dataIsolation->getOfficialOrganizationCodes()],
                            ['key' => 'status', 'value' => SlidesTemplateStatus::Enabled->value],
                        ]],
                        ['must' => $this->currentUserConditions($dataIsolation)],
                    ],
                ]],
            ];
        }

        return ['must' => $must];
    }

    /** Build organization and ownership conditions for personal templates. */
    private function currentUserConditions(SlidesTemplateDataIsolation $dataIsolation): array
    {
        return [
            ['key' => 'organization_code', 'value' => $dataIsolation->getCurrentOrganizationCode()],
            ['key' => 'owner_type', 'value' => SlidesTemplateOwnerType::User->value],
            ['key' => 'owner_id', 'value' => $dataIsolation->getCurrentUserId()],
        ];
    }

    /** Generate embeddings through the shared knowledge-base pipeline. */
    private function embedText(
        SlidesTemplateDataIsolation $dataIsolation,
        string $text,
        array $options = [],
    ): array {
        return $this->embeddingGenerator->embedText($this->embeddingGenerator->getDefaultModel($dataIsolation), $text, $options);
    }
}
