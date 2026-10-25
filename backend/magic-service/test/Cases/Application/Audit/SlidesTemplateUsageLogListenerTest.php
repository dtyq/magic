<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\Audit;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Domain\Audit\ResourceAccess\Repository\Facade\ResourceAccessLogRepositoryInterface;
use App\Domain\Audit\ResourceAccess\Service\ResourceAccessLogDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUsedEvent;
use App\Infrastructure\Audit\Listener\ResourceAccessLogListener;
use App\Infrastructure\Audit\Repository\Model\ResourceAccessLogModel;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateUsageLogListenerTest extends TestCase
{
    public function testProcessWritesSlidesTemplateUsageLog(): void
    {
        $repository = new RecordingResourceAccessLogRepository();
        $domainService = new ResourceAccessLogDomainService($repository);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        $listener = new ResourceAccessLogListener(new SlidesTemplateUsageLogListenerTestContainer($domainService, $loggerFactory));

        $template = new SlidesTemplateEntity();
        $template->setCode('PPT-business-minimal')
            ->setLabel(['zh_CN' => '职场白皮书', 'en_US' => 'Corporate Whitepaper'])
            ->setTemplateFileKey('slides/templates/business.zip');

        $listener->process(new SlidesTemplateUsedEvent(
            organizationCode: 'DT001',
            sourceId: SourceId::SLIDES_TEMPLATE_USE,
            callTime: 1234567890000,
            userId: 'user-1',
            userName: '张三',
            requestId: 'request-1',
            template: $template,
        ));

        $entity = $repository->entity;
        $this->assertInstanceOf(ResourceAccessLogEntity::class, $entity);
        $this->assertSame('DT001', $entity->getOrganizationCode());
        $this->assertSame('user-1', $entity->getUserId());
        $this->assertSame('张三', $entity->getUserName());
        $this->assertSame('user', $entity->getActorType());
        $this->assertSame('slides_template', $entity->getResourceType());
        $this->assertSame('PPT-business-minimal', $entity->getResourceCode());
        $this->assertSame('职场白皮书', $entity->getResourceName());
        $this->assertSame('use', $entity->getOperation());
        $this->assertSame('slides_template_use', $entity->getSource());
        $this->assertSame('request-1', $entity->getRequestId());
        $this->assertSame([], $entity->getContext());
    }

    public function testDomainServiceDoesNotSwallowRepositoryFailure(): void
    {
        $domainService = new ResourceAccessLogDomainService(new FailingResourceAccessLogRepository());

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('save failed');

        $domainService->save(new ResourceAccessLogEntity());
    }

    public function testResourceAccessLogModelDoesNotExposeDroppedColumns(): void
    {
        $droppedColumns = [
            'user_agent',
            'ip',
            'resource_owner_organization_code',
            'source_detail',
            'status',
            'trace_id',
            'request_url',
            'resource_snapshot',
        ];

        $properties = (new ReflectionClass(ResourceAccessLogModel::class))->getDefaultProperties();

        $this->assertSame([], array_values(array_intersect($droppedColumns, $properties['fillable'])));
        $this->assertSame([], array_values(array_intersect($droppedColumns, array_keys($properties['casts']))));
    }
}

final readonly class SlidesTemplateUsageLogListenerTestContainer implements ContainerInterface
{
    public function __construct(
        private ResourceAccessLogDomainService $domainService,
        private LoggerFactory $loggerFactory,
    ) {
    }

    public function get(string $id)
    {
        return match ($id) {
            LoggerFactory::class => $this->loggerFactory,
            ResourceAccessLogDomainService::class => $this->domainService,
            default => throw new RuntimeException('Unexpected container dependency: ' . $id),
        };
    }

    public function has(string $id): bool
    {
        return $id === ResourceAccessLogDomainService::class;
    }
}

final class RecordingResourceAccessLogRepository implements ResourceAccessLogRepositoryInterface
{
    public ?ResourceAccessLogEntity $entity = null;

    public function save(ResourceAccessLogEntity $entity): ResourceAccessLogEntity
    {
        $this->entity = $entity;
        return $entity;
    }

    public function queriesRecentlyUsedResources(
        string $organizationCode,
        string $userId,
        string $resourceType,
        string $operation,
        Page $page,
        bool $withTotal = false
    ): array {
        return ['list' => []];
    }
}

final class FailingResourceAccessLogRepository implements ResourceAccessLogRepositoryInterface
{
    public function save(ResourceAccessLogEntity $entity): ResourceAccessLogEntity
    {
        throw new RuntimeException('save failed');
    }

    public function queriesRecentlyUsedResources(
        string $organizationCode,
        string $userId,
        string $resourceType,
        string $operation,
        Page $page,
        bool $withTotal = false
    ): array {
        return ['list' => []];
    }
}
