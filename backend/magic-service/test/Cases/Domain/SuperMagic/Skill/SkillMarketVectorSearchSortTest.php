<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Skill;

use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use App\Domain\SuperMagic\Skill\Service\SkillMarketVectorIndexDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\PointInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Redis\Redis;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionProperty;
use RuntimeException;

/** @internal */
final class SkillMarketVectorSearchSortTest extends TestCase
{
    /**
     * 被替换掉的原始容器，tearDown 时还回去。
     *
     * 这个测试替换的是**进程级**的 ApplicationContext，而不是它自己的某个依赖。
     * 不还原的话，同一进程里后续每个测试看到的 ConfigInterface 都会变成下面这个桩，
     * 于是它们的 config('error_message') 不再返回数组 —— 任何走
     * ExceptionBuilder::throw 的测试都会以
     * "array_merge(): Argument #2 must be of type array, string given" 崩掉。
     * 这不是理论风险：本测试排在前面时，套件里确实有测试就这么挂了。
     */
    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$originalContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }

                if ($id === ConfigInterface::class) {
                    return Mockery::mock(ConfigInterface::class)
                        ->shouldReceive('get')
                        ->andReturnUsing(static fn (string $key, mixed $default = null): mixed => $key === 'app_env' ? 'testing' : $default)
                        ->getMock();
                }

                if (interface_exists($id)) {
                    return Mockery::mock($id);
                }

                throw new RuntimeException('Unsupported service: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class || $id === ConfigInterface::class || interface_exists($id);
            }
        });
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$originalContainer !== null) {
            ApplicationContext::setContainer(self::$originalContainer);
            self::$originalContainer = null;
        }

        parent::tearDownAfterClass();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testSearchKeepsTheBusinessOrderReturnedByFindVisibleByIds(): void
    {
        $repository = Mockery::mock(SkillMarketRepositoryInterface::class);
        $repository->shouldReceive('findVisibleByIds')->once()->andReturn([
            $this->market(3, true, 5, 1),
            $this->market(2, true, 0, 1),
            $this->market(1, false, 99, 100),
        ]);

        $vectorStore = Mockery::mock(VectorStoreInterface::class);
        $vectorStore->shouldReceive('searchPoints')->once()->withArgs(function (...$args): bool {
            return $args[2] === 5 && $args[5] === 5;
        })->andReturn([
            new PointInfo('1', '1', 0.99),
            new PointInfo('2', '1', 0.98),
            new PointInfo('3', '1', 0.97),
        ]);

        $embeddingModel = Mockery::mock(EmbeddingInterface::class);
        $embeddingGenerator = Mockery::mock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->shouldReceive('getDefaultModel')->once()->andReturn($embeddingModel);
        $embeddingGenerator->shouldReceive('embedText')->once()->andReturn([0.1, 0.2]);

        $logger = Mockery::mock(LoggerInterface::class);
        $loggerFactory = Mockery::mock(LoggerFactory::class);
        $loggerFactory->shouldReceive('get')->once()->andReturn($logger);

        $service = new SkillMarketVectorIndexDomainService(
            $repository,
            Mockery::mock(SkillCategoryRelationRepositoryInterface::class),
            Mockery::mock(SkillCategoryRepositoryInterface::class),
            $vectorStore,
            $embeddingGenerator,
            Mockery::mock(Redis::class),
            $loggerFactory,
        );

        $result = $service->search(
            $this->dataIsolation('org', 'user'),
            new SkillQuery(['keyword' => 'skill']),
            new Page(2, 5),
        );

        self::assertSame([3, 2, 1], array_map(static fn (SkillMarketEntity $market): int => $market->getId(), $result));
    }

    private function market(int $id, bool $featured, int $sortOrder, int $totalInstallCount): SkillMarketEntity
    {
        return new SkillMarketEntity([
            'id' => $id,
            'skill_code' => 'skill-' . $id,
            'publisher_id' => 'publisher-' . $id,
            'install_count' => $totalInstallCount,
            'base_install_count' => 0,
            'total_install_count' => $totalInstallCount,
            'is_featured' => $featured,
            'sort_order' => $sortOrder,
        ]);
    }

    private function dataIsolation(string $organizationCode, string $userId): SkillDataIsolation
    {
        $dataIsolation = (new ReflectionClass(SkillDataIsolation::class))->newInstanceWithoutConstructor();
        foreach (['currentOrganizationCode' => $organizationCode, 'currentUserId' => $userId] as $property => $value) {
            $reflectionProperty = new ReflectionProperty(BaseDataIsolation::class, $property);
            $reflectionProperty->setValue($dataIsolation, $value);
        }

        return $dataIsolation;
    }
}
