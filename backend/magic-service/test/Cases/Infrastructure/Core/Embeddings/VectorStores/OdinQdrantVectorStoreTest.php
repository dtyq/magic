<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Core\Embeddings\VectorStores;

use App\Infrastructure\Core\Embeddings\VectorStores\OdinQdrantVectorStore;
use App\Infrastructure\Core\Embeddings\VectorStores\PointInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\Points;
use Hyperf\Qdrant\Struct\Points\ExtendedPointId;
use Hyperf\Qdrant\Struct\Points\Point\ScoredPoint;
use Hyperf\Qdrant\Struct\Points\VectorStruct;
use Hyperf\Qdrant\Struct\Points\WithPayload;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
final class OdinQdrantVectorStoreTest extends TestCase
{
    public function testStructuredFilterKeepsBooleanPayloadConditions(): void
    {
        $store = (new ReflectionClass(OdinQdrantVectorStore::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod($store, 'buildConditions');
        $method->setAccessible(true);

        self::assertCount(1, $method->invoke($store, [
            ['key' => 'is_hidden', 'value' => false],
        ]));
    }

    public function testSearchPassesScoreThresholdToQdrantAndPreservesResultOrder(): void
    {
        $qdrantPoints = $this->createMock(Points::class);
        $qdrantPoints->expects(self::once())->method('searchPoints')->with(
            'slides_templates',
            self::callback(static fn (VectorStruct $vector): bool => $vector->vector === [0.1, 0.2]),
            20,
            null,
            null,
            20,
            self::callback(static fn (WithPayload $payload): bool => $payload->payload === true),
            null,
            0.35,
        )->willReturn([
            new ScoredPoint(new ExtendedPointId('point-2'), 2, 0.9, ['name' => 'second']),
            new ScoredPoint(new ExtendedPointId('point-1'), 1, 0.8, ['name' => 'first']),
        ]);

        $store = (new ReflectionClass(OdinQdrantVectorStore::class))->newInstanceWithoutConstructor();
        $property = (new ReflectionClass(OdinQdrantVectorStore::class))->getProperty('points');
        $property->setAccessible(true);
        $property->setValue($store, $qdrantPoints);

        $result = $store->searchPoints('slides_templates', [0.1, 0.2], 20, 0.35, [], 20);

        self::assertContainsOnlyInstancesOf(PointInfo::class, $result);
        self::assertSame(['point-2', 'point-1'], array_map(
            static fn (PointInfo $point): string => $point->id,
            $result,
        ));
    }
}
