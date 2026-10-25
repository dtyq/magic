<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SlidesTemplate;

use App\Application\Provider\Service\AiAbilityConfigAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRelationRepositoryInterface;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\CollectionInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\PointInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
final class SlidesTemplateVectorIndexDomainServiceTest extends TestCase
{
    private EmbeddingGeneratorInterface $embeddingGenerator;

    protected function setUp(): void
    {
        $this->setContainer();
    }

    protected function tearDown(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null);
    }

    public function testEnabledTemplateIsEmbeddedAndStored(): void
    {
        $template = (new SlidesTemplateEntity())
            ->setId(1001)
            ->setOrganizationCode('ORG001')
            ->setCode('PPT-demo')
            ->setSearchText('ppt-demo custom');

        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);

        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->expects(self::once())->method('embedText')->willReturn([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->method('getCollection')->willReturn(new CollectionInfo('slides_templates', 0, 0, 3));
        $vectorStore->expects(self::once())->method('getCollection');
        $vectorStore->expects(self::once())->method('storePoint');

        $domainService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );

        /** @var SlidesTemplateDataIsolation $dataIsolation */
        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('ORG001')->setCurrentUserId('USER001');

        $domainService->sync($dataIsolation, '1001', 'USER001');
    }

    public function testUnchangedSearchTextUpdatesPayloadWithoutEmbedding(): void
    {
        $template = (new SlidesTemplateEntity())
            ->setId(1001)
            ->setOrganizationCode('ORG001')
            ->setCode('PPT-demo')
            ->setSearchText('ppt-demo custom');

        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);

        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->expects(self::never())->method('embedText');

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::never())->method('getCollection');
        $vectorStore->method('getPoint')->willReturn(new PointInfo(
            '1001',
            '',
            0,
            [
                'template_id' => '1001',
                'template_code' => 'PPT-demo',
                'organization_code' => 'ORG001',
                'owner_type' => 'OFFICIAL',
                'owner_id' => '',
                'category_code' => '',
                'tag_codes' => [],
                'status' => 1,
                'updated_at' => '',
                'search_text' => 'ppt-demo custom',
            ],
        ));
        $vectorStore->expects(self::once())->method('updatePayload')->with(
            'slides_templates',
            '1001',
            self::callback(static fn (array $payload): bool => $payload['search_text'] === 'ppt-demo custom'),
        );
        $vectorStore->expects(self::never())->method('storePoint');

        $domainService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );

        $domainService->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testForcedReembeddingRegeneratesUnchangedSearchText(): void
    {
        $template = $this->template()->setLabel(['zh_CN' => 'Demo template']);
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);

        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->expects(self::once())->method('embedText')->willReturn([0.3, 0.2, 0.1]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->method('getPoint')->willReturn(new PointInfo(
            '1001',
            '',
            0,
            ['search_text' => 'ppt-demo custom'],
        ));
        $vectorStore->expects(self::once())->method('storePoint');
        $vectorStore->expects(self::never())->method('updatePayload');

        $domainService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );

        $domainService->sync($this->dataIsolation(), '1001', 'USER001', true);
    }

    public function testSearchTextChangeRegeneratesEmbedding(): void
    {
        $template = (new SlidesTemplateEntity())
            ->setId(1001)
            ->setOrganizationCode('ORG001')
            ->setCode('PPT-demo')
            ->setSearchText('ppt-demo featured');

        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);

        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->expects(self::once())->method('embedText')->willReturn([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::never())->method('getCollection');
        $vectorStore->method('getPoint')->willReturn(new PointInfo(
            '1001',
            '',
            0,
            [
                'template_id' => '1001',
                'template_code' => 'PPT-demo',
                'organization_code' => 'ORG001',
                'owner_type' => 'OFFICIAL',
                'owner_id' => '',
                'category_code' => '',
                'tag_codes' => [],
                'status' => 1,
                'updated_at' => '',
                'search_text' => 'ppt-demo',
            ],
        ));
        $vectorStore->expects(self::once())->method('storePoint');
        $vectorStore->expects(self::never())->method('updatePayload');

        $domainService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );

        $domainService->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testDisabledVectorSearchStillRemovesStalePoint(): void
    {
        $this->setContainer([], ['vector_index.enabled' => false]);
        $template = $this->template()->setStatus(SlidesTemplateStatus::Disabled);
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->expects(self::once())->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);

        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $embeddingGenerator->expects(self::never())->method('embedText');

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('getCollection')->with('slides_templates')
            ->willReturn(new CollectionInfo('slides_templates', 1, 0, 3));
        $vectorStore->expects(self::once())->method('removePoint')->with('slides_templates', '1001');

        $domainService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );

        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('ORG001')->setCurrentUserId('USER001');

        $domainService->sync($dataIsolation, '1001', 'USER001');
    }

    public function testMissingCollectionIsCreatedBeforeFirstPointIsStored(): void
    {
        $template = $this->template();
        $domainService = $this->enabledDomainService($template);
        $this->setEmbeddingResult([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->method('getPoint')->willReturn(null);
        $vectorStore->expects(self::once())->method('getCollection')->with('slides_templates')->willReturn(null);
        $vectorStore->expects(self::once())->method('createCollection')->with('slides_templates', 3);
        $vectorStore->expects(self::once())->method('storePoint')->with(
            'slides_templates',
            '1001',
            [0.1, 0.2, 0.3],
            self::callback(static fn (array $payload): bool => $payload['search_text'] === 'ppt-demo custom'),
        );

        $this->domainService($domainService, $vectorStore)->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testMissingTemplateRemovesExistingVectorPoint(): void
    {
        $domainService = $this->enabledDomainService(null);
        $this->setEmbeddingResult([], self::never());

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('getCollection')->with('slides_templates')
            ->willReturn(new CollectionInfo('slides_templates', 1, 0, 3));
        $vectorStore->expects(self::once())->method('removePoint')->with('slides_templates', '1001');

        $this->domainService($domainService, $vectorStore)->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testDisabledTemplateRemovesExistingVectorPointWithoutEmbedding(): void
    {
        $template = $this->template()->setStatus(SlidesTemplateStatus::Disabled);
        $domainService = $this->enabledDomainService($template);
        $this->setEmbeddingResult([], self::never());

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('getCollection')->with('slides_templates')
            ->willReturn(new CollectionInfo('slides_templates', 1, 0, 3));
        $vectorStore->expects(self::once())->method('removePoint')->with('slides_templates', '1001');
        $vectorStore->expects(self::never())->method('storePoint');

        $this->domainService($domainService, $vectorStore)->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testMissingTemplateDoesNothingWhenCollectionDoesNotExist(): void
    {
        $domainService = $this->enabledDomainService(null);
        $this->setEmbeddingResult([], self::never());

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('getCollection')->with('slides_templates')->willReturn(null);
        $vectorStore->expects(self::never())->method('removePoint');

        $this->domainService($domainService, $vectorStore)->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testEmptySearchTextStopsSynchronizationBeforeEmbedding(): void
    {
        $template = $this->template()->setSearchText('  ');
        $domainService = $this->enabledDomainService($template);
        $this->setEmbeddingResult([], self::never());

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::never())->method('getPoint');
        $vectorStore->expects(self::never())->method('storePoint');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Slides template search text is empty');

        $this->domainService($domainService, $vectorStore)->sync($this->dataIsolation(), '1001', 'USER001');
    }

    public function testSearchWithoutKeywordDoesNotCallEmbeddingOrQdrant(): void
    {
        $domainService = $this->enabledDomainService(null);
        $this->setEmbeddingResult([], self::never());
        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::never())->method('searchPoints');

        $result = $this->domainService($domainService, $vectorStore)->search(
            $this->dataIsolation(),
            new SlidesTemplateQuery(),
            new Page(1, 20),
        );

        self::assertSame([], $result);
    }

    public function testSearchUsesPageOffsetAndRestoresSimilarityOrder(): void
    {
        $template1 = $this->template()->setId(1)->setCode('PPT-1');
        $template2 = $this->template()->setId(2)->setCode('PPT-2');
        $query = new SlidesTemplateQuery();
        $query->setKeyword('business report');
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->expects(self::once())->method('findVisibleByIds')->with(
            self::anything(),
            ['2', '1'],
        )
            ->willReturn([$template1, $template2]);
        $this->setEmbeddingResult([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('searchPoints')->with(
            'slides_templates',
            [0.1, 0.2, 0.3],
            5,
            0.2,
            self::isType('array'),
            5,
        )->willReturn([
            new PointInfo('2', '', 0.9),
            new PointInfo('1', '', 0.8),
        ]);

        $result = $this->domainService($templateRepository, $vectorStore)->search(
            $this->dataIsolation(),
            $query,
            new Page(2, 5),
        );

        self::assertSame([2, 1], array_map(static fn (SlidesTemplateEntity $template): ?int => $template->getId(), $result));
    }

    public function testSearchScansAdditionalQdrantCandidatesAfterDatabaseFiltering(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword('business report');
        $template1 = $this->template()->setId(1)->setCode('PPT-1');
        $template2 = $this->template()->setId(2)->setCode('PPT-2');

        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $repositoryCalls = 0;
        $templateRepository->expects(self::exactly(2))->method('findVisibleByIds')
            ->willReturnCallback(function (SlidesTemplateDataIsolation $dataIsolation, array $ids) use (&$repositoryCalls, $template1, $template2): array {
                ++$repositoryCalls;
                if ($repositoryCalls === 1) {
                    self::assertSame(['stale', '1'], $ids);
                    return [$template1];
                }
                self::assertSame(['2'], $ids);
                return [$template2];
            });
        $this->setEmbeddingResult([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::exactly(2))->method('searchPoints')
            ->willReturnCallback(function (string $collection, array $embedding, int $limit, float $score, array $filter, int $offset): array {
                self::assertSame('slides_templates', $collection);
                self::assertSame([0.1, 0.2, 0.3], $embedding);
                self::assertSame(2, $limit);
                self::assertSame(0.2, $score);
                self::assertIsArray($filter);
                return match ($offset) {
                    0 => [new PointInfo('stale', '', 0.9), new PointInfo('1', '', 0.8)],
                    2 => [new PointInfo('2', '', 0.7)],
                    default => [],
                };
            });

        $result = $this->domainService($templateRepository, $vectorStore)->search(
            $this->dataIsolation(),
            $query,
            new Page(1, 2),
        );

        self::assertSame([1, 2], array_map(static fn (SlidesTemplateEntity $template): ?int => $template->getId(), $result));
    }

    public function testSearchUsesDatabaseVisibilityQueryForVectorCandidates(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword('stale template');
        $query->setScope(SlidesTemplateQueryScope::Official);

        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->expects(self::once())->method('findVisibleByIds')->with(
            self::anything(),
            ['1001', '1002'],
        )->willReturn([$this->template()->setId(1001)]);
        $this->setEmbeddingResult([0.1, 0.2, 0.3]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('searchPoints')->willReturn([
            new PointInfo('1001', '', 0.9),
            new PointInfo('1002', '', 0.8),
        ]);

        $result = $this->domainService($templateRepository, $vectorStore)->search(
            $this->dataIsolation(),
            $query,
            new Page(1, 20),
        );

        self::assertSame([1001], array_map(static fn (SlidesTemplateEntity $template): ?int => $template->getId(), $result));
    }

    public function testSearchBuildsStrictAnyTagAndOfficialFilters(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword('featured template');
        $query->setCode('PPT-demo');
        $query->setCategoryCode('business');
        $query->setStatus(SlidesTemplateStatus::Enabled->value);
        $query->setTagCodes(['featured', 'blue']);
        $query->setTagMatch(SlidesTemplateTagMatch::Any);
        $query->setScope(SlidesTemplateQueryScope::Official);

        $this->assertSearchFilter($query, static function (array $filter): bool {
            return $filter === ['must' => [
                ['key' => 'template_code', 'value' => 'PPT-demo'],
                ['key' => 'category_code', 'value' => 'business'],
                ['key' => 'status', 'value' => 1],
                ['key' => 'tag_codes', 'any' => ['featured', 'blue']],
                ['key' => 'organization_code', 'any' => ['OFFICIAL001']],
                ['key' => 'status', 'value' => 1],
            ]];
        });
    }

    public function testSearchBuildsAllTagAndUserFilters(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword('personal template');
        $query->setTagCodes(['featured', 'blue']);
        $query->setTagMatch(SlidesTemplateTagMatch::All);
        $query->setScope(SlidesTemplateQueryScope::User);

        $this->assertSearchFilter($query, static function (array $filter): bool {
            return $filter === ['must' => [
                ['key' => 'tag_codes', 'value' => 'featured'],
                ['key' => 'tag_codes', 'value' => 'blue'],
                ['key' => 'organization_code', 'value' => 'ORG001'],
                ['key' => 'owner_type', 'value' => SlidesTemplateOwnerType::User->value],
                ['key' => 'owner_id', 'value' => 'USER001'],
            ]];
        });
    }

    public function testSearchBuildsExplicitOwnerFilterBeforeScopeFilter(): void
    {
        $query = new SlidesTemplateQuery();
        $query->setKeyword('owned template');
        $query->setScope(SlidesTemplateQueryScope::All);
        $query->setOwnerType(SlidesTemplateOwnerType::Organization);
        $query->setOwnerId('OWNER001');

        $this->assertSearchFilter($query, static function (array $filter): bool {
            return $filter === ['must' => [
                ['key' => 'owner_type', 'value' => SlidesTemplateOwnerType::Organization->value],
                ['key' => 'owner_id', 'value' => 'OWNER001'],
            ]];
        });
    }

    private function assertSearchFilter(SlidesTemplateQuery $query, callable $assertion): void
    {
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->expects(self::never())->method('findVisibleByIds');
        $this->setEmbeddingResult([0.1, 0.2, 0.3]);
        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->expects(self::once())->method('searchPoints')->with(
            'slides_templates',
            [0.1, 0.2, 0.3],
            20,
            0.2,
            self::callback($assertion),
            0,
        )->willReturn([]);

        self::assertSame([], $this->domainService($templateRepository, $vectorStore)->search(
            $this->dataIsolation(),
            $query,
            new Page(1, 20),
        ));
    }

    private function domainService(
        SlidesTemplateRepositoryInterface $templateRepository,
        VectorStoreInterface $vectorStore,
    ): SlidesTemplateVectorIndexDomainService {
        return new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class),
            $vectorStore,
            $this->embeddingGenerator,
            $this->redisMock(),
            $this->loggerFactory(),
        );
    }

    private function enabledDomainService(?SlidesTemplateEntity $template): SlidesTemplateRepositoryInterface
    {
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        return $templateRepository;
    }

    private function setEmbeddingResult(array $embedding, mixed $expectation = null): void
    {
        $this->embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $this->embeddingGenerator->expects($expectation ?? self::once())->method('embedText')->willReturn($embedding);
    }

    private function template(): SlidesTemplateEntity
    {
        return (new SlidesTemplateEntity())
            ->setId(1001)
            ->setOrganizationCode('ORG001')
            ->setCode('PPT-demo')
            ->setSearchText('ppt-demo custom');
    }

    private function setContainer(array $services = [], array $config = []): void
    {
        $config += [
            'vector_index.enabled' => true,
            'vector_index.resources.slides_template.enabled' => true,
        ];
        Context::set(
            'embedding_generator:ability_model:knowledge_base_embedding_model',
            ['model_id' => ($config['vector_index.enabled'] ?? true) ? 'test-model' : null],
        );
        if (! isset($services[AiAbilityConfigAppService::class])) {
            $ability = new AiAbilityEntity();
            $ability->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
            $ability->setOrganizationCode('OFFICIAL001');
            $ability->setStatus(($config['vector_index.enabled'] ?? true) ? Status::Enabled : Status::Disabled);
            $ability->setConfig(['model_id' => 'test-model']);
            $abilityDomainService = $this->createMock(AiAbilityDomainService::class);
            $abilityDomainService->method('getByCode')->willReturn($ability);
            $services[AiAbilityConfigAppService::class] = new AiAbilityConfigAppService(
                $abilityDomainService,
                $this->createMock(ProviderModelDomainService::class)
            );
        }
        ApplicationContext::setContainer(new class($services, $config) implements ContainerInterface {
            public function __construct(
                private readonly array $services,
                private readonly array $config,
            ) {
            }

            public function get(string $id): mixed
            {
                if (array_key_exists($id, $this->services)) {
                    return $this->services[$id];
                }

                return new class($this->config) implements ConfigInterface {
                    public function __construct(private readonly array $config)
                    {
                    }

                    public function get(string $key, mixed $default = null): mixed
                    {
                        if ($key === 'magic_flows.default_embedding_model') {
                            return 'test-embedding-model';
                        }

                        return $this->config[$key] ?? $default;
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
                return $id === ConfigInterface::class || array_key_exists($id, $this->services);
            }
        });
    }

    private function dataIsolation(): SlidesTemplateDataIsolation
    {
        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('ORG001')->setCurrentUserId('USER001');
        $dataIsolation->setOfficialOrganizationCodes(['OFFICIAL001']);
        return $dataIsolation;
    }

    private function loggerFactory(): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        return $loggerFactory;
    }

    private function redisMock(): Redis
    {
        return $this->createMock(Redis::class);
    }
}
