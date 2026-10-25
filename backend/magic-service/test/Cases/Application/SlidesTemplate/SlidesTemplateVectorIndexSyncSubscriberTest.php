<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SlidesTemplate;

use App\Application\SlidesTemplate\Event\Subscribe\SlidesTemplateVectorIndexSyncSubscriber;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Event\SlidesTemplateBatchReindexRequestedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateCreatedEvent;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRelationRepositoryInterface;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\VectorStores\PointInfo;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\ContainerInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
final class SlidesTemplateVectorIndexSyncSubscriberTest extends TestCase
{
    protected function tearDown(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null);
    }

    public function testSingleTemplateSyncLogsStartAndCompletion(): void
    {
        $template = (new SlidesTemplateEntity())
            ->setId(1)
            ->setOrganizationCode('ORG001')
            ->setCode('template-1')
            ->setSearchText('search text');
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturn($template);
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);

        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->method('getPoint')->willReturn(new PointInfo(
            '1',
            '',
            0,
            ['search_text' => 'search text'],
        ));
        $vectorStore->expects(self::once())->method('updatePayload');
        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::exactly(2))->method('info');
        $logger->expects(self::never())->method('error');
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects(self::once())->method('get')->with('vector-index-sync')->willReturn($logger);

        $this->setContainer($this->createMock(EventDispatcherInterface::class));
        $subscriber = new SlidesTemplateVectorIndexSyncSubscriber(
            new SlidesTemplateVectorIndexDomainService(
                $templateRepository,
                $tagRelationRepository,
                $vectorStore,
                $embeddingGenerator,
                $this->redisMock(),
                $this->domainLoggerFactory(),
            ),
            $loggerFactory,
        );

        $subscriber->process(new SlidesTemplateCreatedEvent('1', 'ORG001', 'user-1'));
    }

    public function testBatchReindexContinuesAndQueuesOnlyFailedTemplateForTechnicalRetry(): void
    {
        $processedIds = [];
        $templateRepository = $this->createMock(SlidesTemplateRepositoryInterface::class);
        $templateRepository->method('findById')->willReturnCallback(function (mixed $dataIsolation, string $resourceId) use (&$processedIds): SlidesTemplateEntity {
            $processedIds[] = $resourceId;
            if ($resourceId === 'template-2') {
                throw new RuntimeException('temporary embedding failure');
            }

            return (new SlidesTemplateEntity())
                ->setId((int) str_replace('template-', '', $resourceId))
                ->setOrganizationCode('ORG001')
                ->setCode($resourceId)
                ->setSearchText('search text');
        });
        $tagRelationRepository = $this->createMock(SlidesTemplateTagRelationRepositoryInterface::class);
        $tagRelationRepository->method('findTagsByTemplateIds')->willReturn([]);
        $vectorStore = $this->createMock(VectorStoreInterface::class);
        $vectorStore->method('getPoint')->willReturn(new PointInfo(
            '1',
            '',
            0,
            ['search_text' => 'search text'],
        ));
        $vectorStore->method('updatePayload');
        $embeddingGenerator = $this->createMock(EmbeddingGeneratorInterface::class);
        $domainIndexService = new SlidesTemplateVectorIndexDomainService(
            $templateRepository,
            $tagRelationRepository,
            $vectorStore,
            $embeddingGenerator,
            $this->redisMock(),
            $this->domainLoggerFactory(),
        );
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::once())
            ->method('dispatch')
            ->with(self::callback(static function (object $event): bool {
                return $event instanceof SlidesTemplateBatchReindexRequestedEvent
                    && $event->slidesTemplateIds === ['template-2']
                    && $event->organizationCode === 'ORG001'
                    && $event->operatorId === 'user-1';
            }))
            ->willReturnArgument(0);
        $this->setContainer($dispatcher);

        $subscriber = new SlidesTemplateVectorIndexSyncSubscriber($domainIndexService, $this->createMock(LoggerFactory::class));
        $subscriber->process(new SlidesTemplateBatchReindexRequestedEvent(
            ['template-1', 'template-2', 'template-3'],
            'ORG001',
            'user-1',
        ));

        self::assertSame(['template-1', 'template-2', 'template-3'], $processedIds);
    }

    private function setContainer(EventDispatcherInterface $dispatcher): void
    {
        $config = new class implements ConfigInterface {
            public function get(string $key, mixed $default = null): mixed
            {
                return match ($key) {
                    'app_env' => 'test',
                    'vector_index.enabled' => true,
                    'vector_index.resources.slides_template.enabled' => true,
                    'magic_flows.default_embedding_model' => 'test-model',
                    default => $default,
                };
            }

            public function has(string $keys): bool
            {
                return false;
            }

            public function set(string $key, mixed $value): void
            {
            }
        };

        $services = [
            EventDispatcherInterface::class => $dispatcher,
            ConfigInterface::class => $config,
            ThirdPlatformDataIsolationManagerInterface::class => $this->createMock(ThirdPlatformDataIsolationManagerInterface::class),
            SubscriptionManagerInterface::class => $this->createMock(SubscriptionManagerInterface::class),
            OrganizationInfoManagerInterface::class => $this->createMock(OrganizationInfoManagerInterface::class),
        ];

        ApplicationContext::setContainer(new class($services) implements ContainerInterface {
            public function __construct(private array $services)
            {
            }

            public function get(string $id): mixed
            {
                return $this->services[$id] ?? throw new RuntimeException('Unexpected dependency: ' . $id);
            }

            public function has(string $id): bool
            {
                return array_key_exists($id, $this->services);
            }

            public function make(string $name, array $parameters = []): mixed
            {
                return $this->get($name);
            }

            public function set(string $name, mixed $entry): void
            {
                $this->services[$name] = $entry;
            }

            public function unbind(string $name): void
            {
                unset($this->services[$name]);
            }

            public function define(string $name, mixed $definition): void
            {
                $this->services[$name] = $definition;
            }
        });
    }

    private function domainLoggerFactory(): LoggerFactory
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
