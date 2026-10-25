<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\OdinEmbeddingGenerator;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\SimpleCache\CacheInterface;
use ReflectionClass;

/**
 * @internal
 */
final class OdinEmbeddingGeneratorTest extends TestCase
{
    protected function tearDown(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null);
    }

    public function testEmptyEmbeddingResponseIsNotCached(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('has')->willReturn(false);
        $cache->expects(self::never())->method('set');

        $model = $this->createMock(MagicAILocalModel::class);
        $model->method('getModelName')->willReturn('empty-model');
        $model->method('getVectorSize')->willReturn(0);
        $model->expects(self::once())->method('embeddings')->willReturn($this->response([]));

        $this->assertSame([], (new OdinEmbeddingGenerator($cache))->embedText($model, 'empty result'));
    }

    public function testNonEmptyEmbeddingUsesEmbeddingCachePrefix(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('has')->willReturn(false);
        $cache->expects(self::once())->method('set')->with(
            self::callback(static fn (string $key): bool => str_starts_with($key, 'embedding:')),
            self::callback(static fn (array $data): bool => $data['embeddings'] === [0.1, 0.2]),
            3600 * 24 * 3,
        );

        $model = $this->createMock(EmbeddingInterface::class);
        $model->method('getModelName')->willReturn('working-model');
        $model->method('getVectorSize')->willReturn(2);
        $model->expects(self::once())->method('embeddings')->willReturn($this->response([0.1, 0.2]));

        $this->assertSame([0.1, 0.2], (new OdinEmbeddingGenerator($cache))->embedText($model, 'working result'));
    }

    public function testNullModelUsesConfiguredDefaultModel(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('has')->willReturn(false);

        $model = $this->createMock(MagicAILocalModel::class);
        $model->method('getModelName')->willReturn('default-model');
        $model->method('getVectorSize')->willReturn(2);
        $model->expects(self::once())->method('embeddings')->willReturn($this->response([0.1, 0.2]));

        $dataIsolation = (new ReflectionClass(BaseDataIsolation::class))->newInstanceWithoutConstructor();
        $mapper = $this->createMock(ModelGatewayMapper::class);
        $mapper->expects(self::once())->method('getEmbeddingModelProxy')
            ->with($dataIsolation, 'test-vector-model')
            ->willReturn($model);

        ApplicationContext::setContainer(new class($mapper) implements ContainerInterface {
            public function __construct(private readonly ModelGatewayMapper $mapper)
            {
            }

            public function get(string $id): mixed
            {
                if ($id === ModelGatewayMapper::class) {
                    return $this->mapper;
                }

                return new class implements ConfigInterface {
                    public function get(string $key, mixed $default = null): mixed
                    {
                        if ($key === 'vector_index.embedding_model') {
                            return 'test-vector-model';
                        }

                        return $default;
                    }

                    public function has(string $keys): bool
                    {
                        return false;
                    }

                    public function set(string $key, mixed $value): void
                    {
                    }
                };
            }

            public function has(string $id): bool
            {
                return $id === ModelGatewayMapper::class || $id === ConfigInterface::class;
            }
        });

        $this->assertSame([0.1, 0.2], (new OdinEmbeddingGenerator($cache))->embedText(
            null,
            'default result',
            [],
            $dataIsolation,
        ));
    }

    private function response(array $embedding): EmbeddingResponse
    {
        $data = $embedding === [] ? [] : [[
            'object' => 'embedding',
            'embedding' => $embedding,
            'index' => 0,
        ]];

        return new EmbeddingResponse(new PsrResponse(
            200,
            ['Content-Type' => 'application/json'],
            json_encode(['object' => 'list', 'data' => $data, 'model' => 'test-model'], JSON_THROW_ON_ERROR),
        ));
    }
}
