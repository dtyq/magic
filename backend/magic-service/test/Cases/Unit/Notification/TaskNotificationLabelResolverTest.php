<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\SuperMagic\Task\Service\TaskNotificationLabelResolver;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/** @internal */
final class TaskNotificationLabelResolverTest extends TestCase
{
    public function testEntityContextFillsMissingWorkspaceFromProject(): void
    {
        $topic = $this->createMock(TopicEntity::class);
        $topic->method('getId')->willReturn(123);
        $topic->method('getTopicName')->willReturn('Topic');
        $topic->method('getProjectId')->willReturn(84);
        $topic->method('getWorkspaceId')->willReturn(0);

        $task = $this->createMock(TaskEntity::class);
        $task->method('getId')->willReturn(456);
        $task->method('getProjectId')->willReturn(0);
        $task->method('getWorkspaceId')->willReturn(0);

        $project = $this->createMock(ProjectEntity::class);
        $project->method('getId')->willReturn(84);
        $project->method('getProjectName')->willReturn('Project');
        $project->method('getWorkspaceId')->willReturn(42);

        $workspace = $this->createMock(WorkspaceEntity::class);
        $workspace->method('getName')->willReturn('Workspace');

        $topicService = $this->createMock(TopicDomainService::class);
        $projectService = $this->createMock(ProjectDomainService::class);
        $projectService->expects(self::never())->method('getProjectNotUserId');
        $workspaceService = $this->createMock(WorkspaceDomainService::class);
        $workspaceService->expects(self::once())->method('getWorkspaceDetail')->with(42)->willReturn($workspace);

        $resolver = new TaskNotificationLabelResolver(
            $topicService,
            $projectService,
            $workspaceService,
            $this->loggerFactory()
        );

        $labels = $resolver->resolve(task: $task, topic: $topic, project: $project);

        self::assertSame('Topic', $labels['topic_name']);
        self::assertSame('84', $labels['project_id']);
        self::assertSame('Project', $labels['project_name']);
        self::assertSame('42', $labels['workspace_id']);
        self::assertSame('Workspace', $labels['workspace_name']);
    }

    private function loggerFactory(): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        return $loggerFactory;
    }
}
