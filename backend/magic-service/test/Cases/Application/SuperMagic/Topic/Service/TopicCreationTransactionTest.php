<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Topic\Service;

use App\Application\SuperMagic\Topic\Service\TopicAppService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\HiddenType;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\SuperMagic\Topic\DTO\Request\SaveTopicRequestDTO;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;

/** @internal */
final class TopicCreationTransactionTest extends CreationTransactionTestCase
{
    #[DataProvider('normalCreationMethods')]
    public function testDefaultIsFinalWriteAndRootRunsAfterCommit(string $method): void
    {
        $result = $this->service()->{$method}($this->requestContext(), $this->request());
        self::assertSame('42', $result->getId());
        self::assertSame('99', $result->getChatTopicId());
        $expected = ['identity', 'begin', 'im-topic', 'topic', 'project-mode', 'default', 'commit', 'root', 'event'];
        if ($method === 'createTopic') {
            $expected[] = 'event';
        }
        self::assertSame($expected, $this->events);
    }

    #[DataProvider('normalCreationMethods')]
    public function testTopicFailureDoesNotSetDefault(string $method): void
    {
        try {
            $this->service('topic')->{$method}($this->requestContext(), $this->request());
            self::fail('Expected creation failure');
        } catch (BusinessException $e) {
            self::assertSame(SuperAgentErrorCode::CREATE_TOPIC_FAILED->value, $e->getCode());
        }
        self::assertSame(['identity', 'begin', 'im-topic', 'topic', 'rollback'], $this->events);
    }

    #[DataProvider('normalCreationMethods')]
    public function testRootFailureAfterCommitDoesNotRollBack(string $method): void
    {
        try {
            $this->service('root')->{$method}($this->requestContext(), $this->request());
            self::fail('Expected root failure');
        } catch (BusinessException $e) {
            self::assertSame(SuperAgentErrorCode::CREATE_TOPIC_FAILED->value, $e->getCode());
        }
        self::assertContains('commit', $this->events);
        self::assertNotContains('rollback', $this->events);
        self::assertSame(0, $this->transactionLevel);
    }

    public static function normalCreationMethods(): array
    {
        return [['createTopic'], ['createTopicNotValidateAccessibleProject']];
    }

    public function testHiddenMetadataCommitsBeforeRoot(): void
    {
        $topic = $this->service()->ensureHiddenTopic($this->requestContext(), 7, HiddenType::PRE_WARM->value);
        self::assertSame(42, $topic->getId());
        self::assertSame('42', $topic->getSandboxId());
        self::assertSame(['identity', 'begin', 'im-topic', 'topic', 'sandbox', 'default', 'commit', 'root'], $this->events);
    }

    public function testHiddenTopicFailureRollsBackImWithoutDefault(): void
    {
        try {
            $this->service('topic')->ensureHiddenTopic($this->requestContext(), 7, HiddenType::PRE_WARM->value);
            self::fail('Expected topic failure');
        } catch (RuntimeException $e) {
            self::assertSame('topic failed', $e->getMessage());
        }
        self::assertSame(['identity', 'begin', 'im-topic', 'topic', 'rollback'], $this->events);
    }

    public function testHiddenDefaultFailureRollsBackMetadataWithoutRoot(): void
    {
        try {
            $this->service('default')->ensureHiddenTopic($this->requestContext(), 7, HiddenType::PRE_WARM->value);
            self::fail('Expected default failure');
        } catch (RuntimeException) {
            self::assertSame(['identity', 'begin', 'im-topic', 'topic', 'sandbox', 'default', 'rollback'], $this->events);
        }
    }

    public function testExistingHiddenTopicPreservesIdentityAndSkipsCreation(): void
    {
        $topic = $this->topic();
        $topic->setSandboxId('existing-sandbox');
        $actual = $this->service(existingTopic: $topic)->ensureHiddenTopic($this->requestContext(), 7, HiddenType::PRE_WARM->value);
        self::assertSame($topic, $actual);
        self::assertSame('existing-sandbox', $actual->getSandboxId());
        self::assertSame([], $this->events);
    }

    public function testRejectedOuterTransactionIsNotRolledBack(): void
    {
        $this->transactionLevel = 1;
        try {
            $this->service()->createTopicNotValidateAccessibleProject($this->requestContext(), $this->request());
            self::fail('Expected boundary rejection');
        } catch (BusinessException $e) {
            self::assertSame(SuperAgentErrorCode::CREATE_TOPIC_FAILED->value, $e->getCode());
        }
        self::assertSame(['identity'], $this->events);
        self::assertSame(1, $this->transactionLevel);
    }

    private function request(): SaveTopicRequestDTO
    {
        $request = new SaveTopicRequestDTO();
        $request->setProjectId('7');
        $request->setWorkspaceId('1');
        $request->setProjectMode('general');
        return $request;
    }

    private function service(?string $failure = null, ?TopicEntity $existingTopic = null): TopicAppService
    {
        $service = $this->getMockBuilder(TopicAppService::class)->disableOriginalConstructor()->onlyMethods(['getAccessibleProjectWithEditor'])->getMock();
        $service->method('getAccessibleProjectWithEditor')->willReturn($this->project());
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('findHiddenTopicByProjectUserAndType')->willReturn($existingTopic);
        $topics->method('createTopic')->willReturnCallback(function ($isolation, $workspace, $project, $conversation, $chatTopic) use ($failure): TopicEntity {
            self::assertSame(1, $this->transactionLevel);
            self::assertSame('11', $conversation);
            self::assertSame('99', $chatTopic);
            $this->events[] = 'topic';
            if ($failure === 'topic') {
                throw new RuntimeException('topic failed');
            }
            return $this->topic();
        });
        $topics->method('updateTopicSandboxId')->willReturnCallback(function (): bool {
            self::assertSame(1, $this->transactionLevel);
            $this->events[] = 'sandbox';
            return true;
        });
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectNotUserId')->willReturn($this->project());
        $projects->method('saveProjectEntity')->willReturnCallback(function ($project) {
            $this->events[] = 'project-mode';
            return $project;
        });
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('findOrCreateTopicRootDirectory')->willReturnCallback(function () use ($failure): int {
            self::assertSame(0, $this->transactionLevel);
            $this->events[] = 'root';
            if ($failure === 'root') {
                throw new RuntimeException('root failed');
            }
            return 1;
        });
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnCallback(function (object $event): object {
            self::assertSame(0, $this->transactionLevel);
            $this->events[] = 'event';
            return $event;
        });
        $this->inject($service, ['chatAppService' => $this->chat($failure), 'topicDomainService' => $topics, 'projectDomainService' => $projects, 'taskFileDomainService' => $files, 'eventDispatcher' => $dispatcher]);
        return $service;
    }
}
