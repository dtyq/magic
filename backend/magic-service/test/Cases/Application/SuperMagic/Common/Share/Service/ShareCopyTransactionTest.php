<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Common\Share\Service;

use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Domain\SuperMagic\File\Service\AudioProjectDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use Hyperf\Amqp\Producer;
use HyperfTest\Cases\Application\SuperMagic\Topic\Service\CreationTransactionTestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/** @internal */
final class ShareCopyTransactionTest extends CreationTransactionTestCase
{
    public function testCopyFinalizesAfterMetadataAndPublishesAfterCommit(): void
    {
        $response = $this->invoke();
        self::assertSame('7', $response['new_project_id']);
        self::assertSame('8', $response['copy_record_id']);
        self::assertSame(['identity', 'begin', 'members', 'im-topic', 'topic', 'root', 'workspace', 'project', 'audio-copy', 'default', 'commit', 'publish'], $this->events);
    }

    #[DataProvider('preCommitFailures')]
    public function testFailedPreparationDoesNotPublish(string $failure): void
    {
        try {
            $this->invoke($failure);
            self::fail('Expected injected preparation failure');
        } catch (RuntimeException) {
            self::assertSame('rollback', end($this->events));
        }
        self::assertNotContains('commit', $this->events);
        self::assertNotContains('publish', $this->events);
        if ($failure !== 'default') {
            self::assertNotContains('default', $this->events);
        }
    }

    public static function preCommitFailures(): array
    {
        return [['root'], ['audio-copy'], ['default']];
    }

    public function testPublishFailurePreservesCommitAndMarksForkFailed(): void
    {
        $this->invoke('publish');
        self::assertSame(['default', 'commit', 'publish', 'fork-failed'], array_slice($this->events, -4));
        self::assertNotContains('rollback', $this->events);
    }

    private function invoke(?string $failure = null): array
    {
        $record = function (string $event) use ($failure): void {
            $this->events[] = $event;
            if ($event === $failure) {
                throw new RuntimeException($event . ' failed');
            }
        };
        $workspace = new WorkspaceEntity(['id' => 1, 'user_id' => 'user', 'user_organization_code' => 'org']);
        $workspaces = $this->createMock(WorkspaceDomainService::class);
        $workspaces->method('getWorkspaceDetail')->willReturn($workspace);
        $workspaces->method('saveWorkspaceEntity')->willReturnCallback(static function ($entity) use ($record) {
            $record('workspace');
            return $entity;
        });
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectNotUserId')->willReturn($this->project());
        $projects->method('forkProject')->willReturn([$this->project(), new ProjectForkEntity(['id' => 8, 'source_project_id' => 5, 'fork_project_id' => 7])]);
        $projects->method('saveProjectEntity')->willReturnCallback(static function ($entity) use ($record) {
            $record('project');
            return $entity;
        });
        $projects->method('markForkRecordFailed')->willReturnCallback(static function () use ($record): bool {
            $record('fork-failed');
            return true;
        });
        $members = $this->createMock(ProjectMemberDomainService::class);
        $members->method('initializeProjectMemberAndSettings')->willReturnCallback(static function () use ($record): void { $record('members'); });
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('createTopic')->willReturnCallback(function ($isolation, $workspaceId, $projectId, $conversationId, $chatTopicId) use ($record) {
            self::assertSame('11', $conversationId);
            self::assertSame('99', $chatTopicId);
            $record('topic');
            return $this->topic();
        });
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('findOrCreateTopicRootDirectory')->willReturnCallback(function () use ($record): int {
            self::assertSame(1, $this->transactionLevel);
            self::assertNotContains('default', $this->events);
            $record('root');
            return 1;
        });
        $audio = $this->createMock(AudioProjectDomainService::class);
        $audio->method('copyAudioProjectForFork')->willReturnCallback(static function () use ($record): void { $record('audio-copy'); });
        $producer = $this->createMock(Producer::class);
        $producer->method('produce')->willReturnCallback(function () use ($record): bool {
            self::assertSame(0, $this->transactionLevel);
            $record('publish');
            return true;
        });
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnArgument(0);
        $this->services[EventDispatcherInterface::class] = $dispatcher;
        $service = (new ReflectionClass(ResourceShareAppService::class))->newInstanceWithoutConstructor();
        $this->inject($service, ['chatAppService' => $this->chat($failure), 'workspaceDomainService' => $workspaces, 'projectDomainService' => $projects, 'projectMemberDomainService' => $members, 'topicDomainService' => $topics, 'taskFileDomainService' => $files, 'audioProjectDomainService' => $audio, 'producer' => $producer]);
        return (new ReflectionMethod($service, 'executeCopy'))->invoke($service, $this->authorization(), 5, 1, 'copy', [100]);
    }
}
