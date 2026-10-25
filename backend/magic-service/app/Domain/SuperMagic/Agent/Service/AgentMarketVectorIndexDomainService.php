<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\Kernel\Service\AbstractVectorIndexDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentCategoryRelationType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use RuntimeException;
use Throwable;

final class AgentMarketVectorIndexDomainService extends AbstractVectorIndexDomainService
{
    public function __construct(
        private readonly AgentMarketRepositoryInterface $agentMarketRepository,
        private readonly AgentCategoryRelationRepositoryInterface $categoryRelationRepository,
        private readonly AgentCategoryRepositoryInterface $categoryRepository,
        VectorStoreInterface $vectorStore,
        EmbeddingGeneratorInterface $embeddingGenerator,
        Redis $redis,
        LoggerFactory $loggerFactory,
    ) {
        parent::__construct($vectorStore, $embeddingGenerator, $redis, $loggerFactory);
    }

    /** Synchronize one market point from the authoritative database state. */
    public function sync(string $resourceId, string $operatorId, bool $forceReEmbedding = false): void
    {
        $market = $this->agentMarketRepository->findById((int) $resourceId);
        if ($market === null
            || ! $market->getPublishStatus()->isPublished()
            || $market->isHidden()
            || ! in_array($market->getMarketType(), [AgentMarketType::MARKET, AgentMarketType::ORGANIZATION], true)
        ) {
            $this->removePoint($resourceId);
            return;
        }

        if (! $this->isVectorSearchEnabled()) {
            $this->removePoint($resourceId);
            return;
        }

        $categories = $this->findCategories($market);
        $semanticText = AgentMarketSearchTextBuilder::buildSemanticText($market, $categories);
        if ($semanticText === '') {
            throw new RuntimeException('Agent market semantic text is empty');
        }

        $collectionName = $this->collectionName();
        $pointId = (string) $market->getId();
        $payload = $this->buildPayload($market, $semanticText);
        $existingPoint = $this->vectorStore->getPoint($collectionName, $pointId);

        if ($existingPoint !== null && ! $forceReEmbedding && ($existingPoint->payload['semantic_text'] ?? null) === $semanticText) {
            $this->logger->info('Agent market vector payload update without re-embedding', [
                'resource_id' => $resourceId,
                'reason' => 'semantic_text_unchanged',
            ]);
            $this->vectorStore->updatePayload($collectionName, $pointId, $payload);
            $this->availabilityCache = true;
            return;
        }

        $embedding = $this->generateEmbedding(
            $market,
            $semanticText,
            $operatorId,
            $existingPoint === null
                ? 'point_not_found'
                : ($forceReEmbedding ? 'force_re_embedding' : 'semantic_text_changed'),
        );
        $this->ensureCollection($collectionName, $embedding, $forceReEmbedding);

        $this->vectorStore->storePoint($collectionName, $pointId, $embedding, $payload);
        $this->availabilityCache = true;
    }

    /** Remove Qdrant points that no longer have a visible market record. */
    public function removeOrphanPoints(): int
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
                $existingIds = $this->agentMarketRepository->findVisibleByIds(array_map('intval', $pointIds));
                $orphanIds = array_values(array_filter(
                    $pointIds,
                    static fn (string $pointId): bool => ! isset($existingIds[(int) $pointId]),
                ));
                if ($orphanIds !== []) {
                    $this->vectorStore->removePoints($collectionName, $orphanIds);
                    $removed += count($orphanIds);
                    $this->logger->info('Agent market orphan vector points removed', [
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

    /** Search semantic candidates, then apply authoritative MySQL visibility filtering. */
    public function search(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentMarketQuery $query,
        Page $page,
    ): array {
        $keyword = $this->normalizeKeyword($query->getKeyword());
        if ($keyword === '') {
            return [];
        }

        $embedding = $this->embeddingGenerator->embedText(
            $this->embeddingGenerator->getDefaultModel($dataIsolation),
            $keyword,
            [
                'business_params' => [
                    'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'business_id' => 'agent-market-search:' . md5($keyword),
                    'source_id' => SourceId::SEMANTIC_SEARCH,
                ],
            ],
        );
        if ($embedding === []) {
            return [];
        }

        $this->assertEmbeddingDimension($this->collectionName(), $embedding);

        $pageSize = $page->getPageNum();
        $points = $this->vectorStore->searchPoints(
            $this->collectionName(),
            $embedding,
            $pageSize,
            (float) config('vector_index.resources.agent_market.score_threshold', 0.4),
            $this->buildFilter($query),
            $page->getSliceStart(),
        );
        $ids = array_values(array_unique(array_map(
            static fn ($point): string => (string) $point->id,
            $points,
        )));
        if ($ids === []) {
            return [];
        }

        // Qdrant ranks candidates; MySQL remains the authoritative visibility source.
        $markets = $this->agentMarketRepository->findVisibleByIdsForSearch(array_map('intval', $ids), $query);
        $marketsById = [];
        foreach ($markets as $market) {
            $marketsById[(string) $market->getId()] = $market;
        }

        return array_values(array_filter(array_map(
            static fn (string $id): ?AgentMarketEntity => $marketsById[$id] ?? null,
            $ids,
        )));
    }

    /** Return valid market IDs in ascending keyset pages for full reconciliation. */
    public function findVectorIndexIds(string $afterId = '0', int $limit = 100): array
    {
        return $this->agentMarketRepository->findVectorIndexIds($afterId, $limit);
    }

    /** Return the current number of records eligible for vector indexing. */
    public function countVectorIndexRecords(): int
    {
        return $this->agentMarketRepository->countVectorIndexRecords();
    }

    /** Return the current point count, or null when the collection is unavailable. */
    public function countIndexedPoints(): ?int
    {
        try {
            $collection = $this->vectorStore->getCollection($this->collectionName());
            return $collection?->pointsCount;
        } catch (Throwable) {
            return null;
        }
    }

    protected function collectionName(): string
    {
        return (string) config('vector_index.resources.agent_market.collection', 'agent_markets');
    }

    protected function businessLabel(): string
    {
        return 'Agent market';
    }

    protected function initializedKey(): string
    {
        return 'vector_index:initialized:agent_market';
    }

    /** @return array<int, AgentCategoryEntity> */
    private function findCategories(AgentMarketEntity $market): array
    {
        $marketId = $market->getId();
        if ($marketId === null) {
            return [];
        }

        $categoryIds = $this->categoryRelationRepository->findCategoryIds(
            AgentCategoryRelationType::AgentMarket,
            $marketId,
        );
        $market->setCategoryIds($categoryIds);
        return $categoryIds === [] ? [] : $this->categoryRepository->findByIds($categoryIds);
    }

    private function buildPayload(AgentMarketEntity $market, string $semanticText): array
    {
        return [
            'resource_type' => 'agent_market',
            'agent_market_id' => (string) $market->getId(),
            'agent_code' => $market->getAgentCode(),
            'agent_version_id' => $market->getAgentVersionId(),
            'organization_code' => $market->getOrganizationCode(),
            'market_type' => $market->getMarketType()?->value,
            'semantic_text' => $semanticText,
            'publish_status' => $market->getPublishStatus()->value,
            'is_hidden' => $market->isHidden() ? 1 : 0,
            'publisher_type' => $market->getPublisherType()->value,
            'publisher_id' => $market->getPublisherId(),
            'category_ids' => $market->getCategoryIds(),
            'is_featured' => $market->isFeatured() ? 1 : 0,
            'install_count' => $market->getInstallCount(),
            'sort_order' => $market->getSortOrder() ?? 0,
            'updated_at' => $market->getUpdatedAt() ?? '',
        ];
    }

    private function generateEmbedding(AgentMarketEntity $market, string $semanticText, string $operatorId, string $reason): array
    {
        $this->logger->info('Agent market embedding generation started', [
            'resource_id' => (string) $market->getId(),
            'reason' => $reason,
            'forced' => $reason === 'force_re_embedding',
            'text_length' => mb_strlen($semanticText),
        ]);
        $embedding = $this->embeddingGenerator->embedText(
            $this->embeddingGenerator->getDefaultModel(
                SuperMagicAgentDataIsolation::create($market->getOrganizationCode() ?? '', $operatorId),
            ),
            $semanticText,
            [
                'business_params' => [
                    'organization_id' => $market->getOrganizationCode() ?? '',
                    'user_id' => $operatorId,
                    'business_id' => 'agent-market:' . $market->getId(),
                    'source_id' => SourceId::AGENT_MARKET_VECTOR_SYNC,
                ],
            ],
        );
        if ($embedding === []) {
            throw new RuntimeException('Agent market embedding is empty');
        }
        $this->logger->info('Agent market embedding generation completed', [
            'resource_id' => (string) $market->getId(),
            'vector_size' => count($embedding),
        ]);

        return $embedding;
    }

    private function buildFilter(AgentMarketQuery $query): array
    {
        $must = [
            ['key' => 'publish_status', 'value' => 'PUBLISHED'],
            ['key' => 'is_hidden', 'value' => 0],
        ];
        if ($query->getCategoryIds() !== []) {
            $must[] = ['key' => 'category_ids', 'any' => $query->getCategoryIds()];
        }

        $marketType = $query->getMarketType();
        if ($marketType === AgentMarketType::MARKET) {
            $must[] = ['key' => 'market_type', 'value' => AgentMarketType::MARKET->value];
            return ['must' => $must];
        }
        if ($marketType === AgentMarketType::ORGANIZATION) {
            $must[] = ['key' => 'market_type', 'value' => AgentMarketType::ORGANIZATION->value];
            $must[] = ['key' => 'organization_code', 'value' => $query->getVisibleOrganizationCode()];
            $must[] = ['key' => 'agent_market_id', 'any' => array_map('strval', $query->getVisibleOrganizationMarketIds())];
            return ['must' => $must];
        }

        $should = [
            ['must' => [['key' => 'market_type', 'value' => AgentMarketType::MARKET->value]]],
        ];
        if ($query->getVisibleOrganizationCode() !== null && $query->getVisibleOrganizationMarketIds() !== []) {
            $should[] = ['must' => [
                ['key' => 'market_type', 'value' => AgentMarketType::ORGANIZATION->value],
                ['key' => 'organization_code', 'value' => $query->getVisibleOrganizationCode()],
                ['key' => 'agent_market_id', 'any' => array_map('strval', $query->getVisibleOrganizationMarketIds())],
            ]];
        }
        $must[] = ['should' => $should, 'min_should' => 1];
        return ['must' => $must];
    }
}
