<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;

/**
 * @internal
 */
class SandboxVersionDomainServiceTest extends TestCase
{
    public function testCheckSandboxVersionUsesCachedLatestImageAndKeepsRule(): void
    {
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topic = (new TopicEntity())
            ->setId(101)
            ->setAgentImage('registry.example.com/agent:v1.0.0');

        $topicDomainService->expects($this->once())
            ->method('getTopicById')
            ->with(101)
            ->willReturn($topic);
        $cache->expects($this->once())
            ->method('get')
            ->with('super_magic:sandbox:latest_agent_image')
            ->willReturn('registry.example.com/agent:v2.0.0');
        $agentDomainService->expects($this->never())->method('getLatestAgentImage');

        $service = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
            $loggerFactory
        );

        $result = $service->checkSandboxVersion(101);

        $this->assertSame('v1.0.0', $result['current_version']);
        $this->assertSame('v2.0.0', $result['latest_version']);
        $this->assertTrue($result['needs_update']);
    }

    public function testCheckNeedUpgradeByTopicIdsReturnsExpectedMapAndWritesCache(): void
    {
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topicA = (new TopicEntity())
            ->setId(201)
            ->setAgentImage('registry.example.com/agent:v2.0.0');
        $topicB = (new TopicEntity())
            ->setId(202)
            ->setAgentImage('');

        $topicDomainService->expects($this->once())
            ->method('getTopicsByIds')
            ->with($this->callback(static function (array $ids): bool {
                sort($ids);
                return $ids === [201, 202];
            }))
            ->willReturn([$topicA, $topicB]);

        $cache->expects($this->once())
            ->method('get')
            ->with('super_magic:sandbox:latest_agent_image')
            ->willReturn(null);
        $agentDomainService->expects($this->once())
            ->method('getLatestAgentImage')
            ->willReturn('registry.example.com/agent:v2.0.0');
        $cache->expects($this->once())
            ->method('set')
            ->with('super_magic:sandbox:latest_agent_image', 'registry.example.com/agent:v2.0.0', 30);

        $service = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
            $loggerFactory
        );

        $result = $service->checkNeedUpgradeByTopicIds([202, 201, 202, 0, -1]);

        $this->assertSame([
            201 => false,
            202 => true,
        ], $result);
    }
}
