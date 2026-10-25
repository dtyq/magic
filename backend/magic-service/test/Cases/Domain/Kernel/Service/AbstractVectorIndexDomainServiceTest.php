<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Kernel\Service;

use App\Domain\Kernel\Service\AbstractVectorIndexDomainService;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\CollectionInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * @internal
 */
final class AbstractVectorIndexDomainServiceTest extends TestCase
{
    public function testRejectsDimensionMismatchWithoutForceReembedding(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('error');
        $store = $this->createMock(VectorStoreInterface::class);
        $store->expects(self::once())->method('getCollection')->willReturn(new CollectionInfo('agent_markets', 1, 1, 2048));
        $store->expects(self::never())->method('removeCollection');

        $this->expectException(RuntimeException::class);
        $this->service(store: $store, logger: $logger)->ensure('agent_markets', array_fill(0, 1536, 0.0));
    }

    public function testEnsureCollectionResolvesSizeFromEmbedding(): void
    {
        $size = 1536;

        $store = $this->createMock(VectorStoreInterface::class);
        $store->method('getCollection')->willReturn(null);
        $store->expects(self::once())->method('createCollection')->with('agent_markets', $size);

        $this->service(store: $store)->ensure('agent_markets', array_fill(0, $size, 0.0));
    }

    public function testForcedRebuildInvalidatesAvailabilityCache(): void
    {
        $size = 1536;

        $store = $this->createMock(VectorStoreInterface::class);
        $store->method('getCollection')->willReturn(new CollectionInfo('agent_markets', 0, 0, 1));
        $store->expects(self::once())->method('removeCollection')->with('agent_markets');
        $store->expects(self::once())->method('createCollection')->with('agent_markets', $size);

        $service = $this->service(store: $store);
        $service->ensure('agent_markets', array_fill(0, $size, 0.0), true);

        self::assertFalse($service->availability());
    }

    private function service(
        ?VectorStoreInterface $store = null,
        ?EmbeddingGeneratorInterface $generator = null,
        ?LoggerInterface $logger = null,
    ): AbstractVectorIndexDomainService {
        $generator ??= $this->createMock(EmbeddingGeneratorInterface::class);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger ?? $this->createMock(LoggerInterface::class));

        return new class($store ?? $this->createMock(VectorStoreInterface::class), $generator, $this->createMock(Redis::class), $loggerFactory) extends AbstractVectorIndexDomainService {
            public function __construct(
                VectorStoreInterface $vectorStore,
                EmbeddingGeneratorInterface $embeddingGenerator,
                Redis $redis,
                LoggerFactory $loggerFactory,
            ) {
                parent::__construct($vectorStore, $embeddingGenerator, $redis, $loggerFactory);
            }

            /** @param array<int, float> $embedding */
            public function ensure(string $collectionName, array $embedding, bool $forceReEmbedding = false): void
            {
                $this->ensureCollection($collectionName, $embedding, $forceReEmbedding);
            }

            public function availability(): ?bool
            {
                return $this->availabilityCache;
            }

            protected function collectionName(): string
            {
                return 'agent_markets';
            }

            protected function businessLabel(): string
            {
                return 'Agent market';
            }

            protected function initializedKey(): string
            {
                return 'vector_index:initialized:agent_market';
            }
        };
    }
}
