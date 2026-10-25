<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use App\Infrastructure\Util\Locker\LockerInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionProperty;

/**
 * @internal
 */
final class TopicTaskAppServiceUserToolCallReplyTest extends TestCase
{
    public function testStaleTaskReplyIsIgnoredBeforeSandboxForwarding(): void
    {
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects($this->never())->method('sendUserToolCallFeedback');
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->never())->method('mutexLock');

        $service = $this->buildService($agent, $locker);

        $service->handleUserToolCallReply(
            $this->buildDataIsolation(),
            'chat-topic-1',
            'ask_user',
            'call-1',
            ['task_id' => '41', 'response_status' => 'skipped'],
        );
    }

    public function testFirstReplyClaimsToolCallAndForwardsOnce(): void
    {
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects($this->once())
            ->method('sendUserToolCallFeedback')
            ->with($this->anything(), 'sandbox-1', 'ask_user', 'call-1', ['task_id' => '42']);
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())
            ->method('mutexLock')
            ->with('user_tool_call_reply:org-1:chat-topic-1:call-1', $this->isType('string'), 86400)
            ->willReturn(true);

        $service = $this->buildService($agent, $locker);

        $service->handleUserToolCallReply(
            $this->buildDataIsolation(),
            'chat-topic-1',
            'ask_user',
            'call-1',
            ['task_id' => '42'],
        );
    }

    public function testAlreadyClaimedReplyIsAcknowledgedWithoutSandboxForwarding(): void
    {
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects($this->never())->method('sendUserToolCallFeedback');
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(false);

        $service = $this->buildService($agent, $locker);

        $service->handleUserToolCallReply(
            $this->buildDataIsolation(),
            'chat-topic-1',
            'ask_user',
            'call-1',
            ['task_id' => '42'],
        );
    }

    public function testFailedSandboxForwardReleasesClaimForRetry(): void
    {
        $agent = $this->createMock(AgentDomainService::class);
        $agent->method('sendUserToolCallFeedback')
            ->willThrowException(new SandboxOperationException('Send user_tool_call feedback', 'boom', 2000));
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(true);
        $locker->expects($this->once())
            ->method('release')
            ->with('user_tool_call_reply:org-1:chat-topic-1:call-1', $this->isType('string'))
            ->willReturn(true);

        $service = $this->buildService($agent, $locker);

        $this->expectException(SandboxOperationException::class);
        $service->handleUserToolCallReply(
            $this->buildDataIsolation(),
            'chat-topic-1',
            'ask_user',
            'call-1',
            ['task_id' => '42'],
        );
    }

    public function testExpiredSandboxReplyKeepsClaimAsTerminal(): void
    {
        $agent = $this->createMock(AgentDomainService::class);
        $agent->method('sendUserToolCallFeedback')
            ->willThrowException(new UserToolCallNotFoundException('问题不存在或已超时', 4100));
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(true);
        $locker->expects($this->never())->method('release');

        $service = $this->buildService($agent, $locker);

        $this->expectException(UserToolCallNotFoundException::class);
        $service->handleUserToolCallReply(
            $this->buildDataIsolation(),
            'chat-topic-1',
            'ask_user',
            'call-1',
            ['task_id' => '42'],
        );
    }

    private function buildService(AgentDomainService $agent, LockerInterface $locker): TopicTaskAppServiceForReplyTest
    {
        $topic = (new TopicEntity())
            ->setCurrentTaskId(42)
            ->setUserOrganizationCode('org-1')
            ->setChatTopicId('chat-topic-1');
        $task = (new TaskEntity())->setId(42)->setSandboxId('sandbox-1');

        $topicDomain = $this->createMock(TopicDomainService::class);
        $topicDomain->method('getTopicByChatTopicId')->willReturn($topic);
        $taskDomain = $this->createMock(TaskDomainService::class);
        $taskDomain->method('getTaskById')->willReturn($task);

        $service = (new ReflectionClass(TopicTaskAppServiceForReplyTest::class))->newInstanceWithoutConstructor();
        $this->setProperty($service, 'topicDomainService', $topicDomain);
        $this->setProperty($service, 'taskDomainService', $taskDomain);
        $this->setProperty($service, 'agentDomainService', $agent);
        $this->setProperty($service, 'locker', $locker);
        $this->setProperty($service, 'logger', new NullLogger());

        return $service;
    }

    private function setProperty(object $object, string $property, mixed $value): void
    {
        $reflection = new ReflectionProperty(TopicTaskAppService::class, $property);
        $reflection->setAccessible(true);
        $reflection->setValue($object, $value);
    }

    private function buildDataIsolation(): DataIsolation
    {
        // Avoid bootstrapping the full Hyperf container in this focused unit test.
        $dataIsolation = (new ReflectionClass(DataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('org-1');
        $dataIsolation->setCurrentUserId('user-1');
        return $dataIsolation;
    }
}

/**
 * @internal
 */
final class TopicTaskAppServiceForReplyTest extends TopicTaskAppService
{
    public function updateTaskStatus(
        DataIsolation $dataIsolation,
        TaskEntity $task,
        TaskStatus $status,
        string $errMsg = ''
    ): void {
    }
}
