<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Audit;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Domain\Audit\ResourceAccess\Repository\Facade\ResourceAccessLogRepositoryInterface;
use App\Domain\Audit\ResourceAccess\Service\ResourceAccessLogDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Event\SkillMarketInstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketUninstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillUsedEvent;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Infrastructure\Audit\Listener\ResourceAccessLogListener;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
final class SkillMarketAccessLogListenerTest extends TestCase
{
    /**
     * @dataProvider eventProvider
     */
    public function testItWritesSkillMarketAccessLog(object $event, string $operation, string $source, string $userName): void
    {
        $repository = $this->createMock(ResourceAccessLogRepositoryInterface::class);
        $repository->expects(self::once())
            ->method('save')
            ->with(self::callback(function (ResourceAccessLogEntity $entity) use ($operation, $source, $userName): bool {
                self::assertSame('org-1', $entity->getOrganizationCode());
                self::assertSame('user-1', $entity->getUserId());
                self::assertSame($userName, $entity->getUserName());
                self::assertSame('skill', $entity->getResourceType());
                self::assertSame('skill-code-1', $entity->getResourceCode());
                self::assertSame($operation === 'use' ? null : '技能名称', $entity->getResourceName());
                self::assertSame($operation, $entity->getOperation());
                self::assertSame($source, $entity->getSource());
                return true;
            }))
            ->willReturnArgument(0);

        $market = new SkillMarketEntity();
        $market->setSkillCode('skill-code-1')
            ->setNameI18n(['zh_CN' => '技能名称']);
        CoContext::setLanguage('zh_CN');

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('info');
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $skillMarketDomainService = $this->createMock(SkillMarketDomainService::class);
        $skillMarketDomainService->method('findByIds')
            ->with([1])
            ->willReturn([1 => $market]);

        $container = $this->createMock(ContainerInterface::class);
        $container
            ->method('get')
            ->willReturnMap([
                [LoggerFactory::class, $loggerFactory],
                [SkillMarketDomainService::class, $skillMarketDomainService],
                [ResourceAccessLogDomainService::class, new ResourceAccessLogDomainService($repository)],
            ]);

        (new ResourceAccessLogListener($container))->process($event);
    }

    public static function eventProvider(): array
    {
        return [
            'install' => [new SkillMarketInstalledEvent('1', 'org-1', 'user-1'), 'install', 'api', ''],
            'uninstall' => [new SkillMarketUninstalledEvent('1', 'org-1', 'user-1'), 'uninstall', 'api', ''],
            'use' => [new SkillUsedEvent(
                organizationCode: 'org-1',
                sourceId: SourceId::SUPER_MAGIC_TOOL,
                callTime: 1234567890000,
                userId: 'user-1',
                userName: 'User One',
                requestId: 'request-1',
                skillCode: 'skill-code-1',
                businessParams: ['task_id' => 'task-1'],
            ), 'use', SourceId::SUPER_MAGIC_TOOL, 'User One'],
        ];
    }

    public function testItUsesSkillUsageEventTimeForAccessLogCreatedAt(): void
    {
        $repository = $this->createMock(ResourceAccessLogRepositoryInterface::class);
        $repository->expects(self::once())
            ->method('save')
            ->with(self::callback(function (ResourceAccessLogEntity $entity): bool {
                self::assertSame(1234567890, $entity->getCreatedAt()?->getTimestamp());
                return true;
            }))
            ->willReturnArgument(0);

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('info');
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([
            [LoggerFactory::class, $loggerFactory],
            [ResourceAccessLogDomainService::class, new ResourceAccessLogDomainService($repository)],
        ]);

        (new ResourceAccessLogListener($container))->process(new SkillUsedEvent(
            organizationCode: 'org-1',
            sourceId: SourceId::SUPER_MAGIC_TOOL,
            callTime: 1234567890000,
            userId: 'user-1',
            userName: 'User One',
            requestId: 'request-1',
            skillCode: 'skill-code-1',
        ));
    }

    public function testItLogsProcessingFailure(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('info');
        $logger->expects(self::once())
            ->method('error')
            ->with(
                'Resource access log processing failed',
                self::callback(static fn (array $context): bool => $context['event'] === SkillUsedEvent::class)
            );
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnMap([
            [LoggerFactory::class, $loggerFactory],
        ]);

        (new ResourceAccessLogListener($container))->process(new SkillUsedEvent(
            organizationCode: 'org-1',
            sourceId: SourceId::SUPER_MAGIC_TOOL,
            callTime: 1234567890000,
            userId: 'user-1',
            userName: 'User One',
            requestId: 'request-1',
            skillCode: 'skill-code-1',
        ));
    }
}
