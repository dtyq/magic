<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\KnowledgeBase\Event\Subscribe;

use App\Application\KnowledgeBase\Event\Subscribe\ProjectFileChangeNotifySubscriber;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\ProjectFileRpcClient;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use stdClass;

/**
 * @internal
 */
class ProjectFileChangeNotifySubscriberTest extends TestCase
{
    public function testListenReturnsSupportedSingleFileEvents(): void
    {
        $subscriber = new ProjectFileChangeNotifySubscriber($this->createMock(ProjectFileRpcClient::class));

        $this->assertSame([
            FileUploadedEvent::class,
            FileContentSavedEvent::class,
            FileDeletedEvent::class,
            FilesBatchDeletedEvent::class,
            FileRenamedEvent::class,
            FileMovedEvent::class,
        ], $subscriber->listen());
    }

    #[DataProvider('singleFileEventProvider')]
    public function testProcessNotifiesGoForSupportedSingleFileEvents(object $event, array $expectedArguments): void
    {
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->once())
            ->method('notifyChange')
            ->with(...$expectedArguments)
            ->willReturn(true);

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->process($event);
    }

    public static function singleFileEventProvider(): array
    {
        $fileEntity = self::createTaskFileEntity(501, false);

        return [
            'uploaded' => [new FileUploadedEvent($fileEntity, 'U1', 'ORG1'), [501]],
            'content_saved' => [new FileContentSavedEvent($fileEntity, 'U1', 'ORG1'), [501]],
            'deleted' => [new FileDeletedEvent($fileEntity, 'U1', 'ORG1'), [501, 'ORG1', 900, 'deleted']],
            'renamed' => [new FileRenamedEvent($fileEntity, self::createAuthorization('U1', 'ORG1')), [501]],
            'moved' => [new FileMovedEvent($fileEntity, self::createAuthorization('U1', 'ORG1')), [501]],
        ];
    }

    public function testProcessNotifiesGoForBatchDeletedEvent(): void
    {
        $calls = [];
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->exactly(2))
            ->method('notifyChange')
            ->willReturnCallback(static function (
                int $projectFileId,
                ?string $organizationCode = null,
                ?int $projectId = null,
                ?string $status = null,
            ) use (&$calls): bool {
                $calls[] = [$projectFileId, $organizationCode, $projectId, $status];
                return true;
            });

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->process(new FilesBatchDeletedEvent(
            900,
            [501, 0, 502],
            self::createAuthorization('U1', 'ORG1')
        ));

        $this->assertSame([
            [501, 'ORG1', 900, 'deleted'],
            [502, 'ORG1', 900, 'deleted'],
        ], $calls);
    }

    public function testProcessSkipsDirectory(): void
    {
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->never())
            ->method('notifyChange');

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->process(new FileUploadedEvent(self::createTaskFileEntity(501, true), 'U1', 'ORG1'));
    }

    public function testProcessSkipsInvalidProjectFileId(): void
    {
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->never())
            ->method('notifyChange');

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->process(new FileContentSavedEvent(self::createTaskFileEntity(0, false), 'U1', 'ORG1'));
    }

    public function testProcessIgnoresUnsupportedEvent(): void
    {
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->never())
            ->method('notifyChange');

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->process(new stdClass());
    }

    public function testProcessLogsAndSwallowsRpcFailure(): void
    {
        $client = $this->createMock(ProjectFileRpcClient::class);
        $client->expects($this->once())
            ->method('notifyChange')
            ->with(501)
            ->willThrowException(new RuntimeException('rpc failed'));

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())
            ->method('error')
            ->with(
                'Failed to notify project file change',
                $this->callback(static function (array $context): bool {
                    return $context['project_file_id'] === 501
                        && $context['project_id'] === 900
                        && $context['file_key'] === '/workspace/demo.md'
                        && $context['user_id'] === 'U1'
                        && $context['organization_code'] === 'ORG1'
                        && $context['event'] === FileMovedEvent::class
                        && $context['error'] === 'rpc failed';
                })
            );

        $subscriber = new ProjectFileChangeNotifySubscriber($client);
        $subscriber->logger = $logger;

        $subscriber->process(new FileMovedEvent(
            self::createTaskFileEntity(501, false),
            self::createAuthorization('U1', 'ORG1'),
        ));

        $this->addToAssertionCount(1);
    }

    private static function createAuthorization(string $userId, string $organizationCode): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setId($userId)
            ->setOrganizationCode($organizationCode);
    }

    private static function createTaskFileEntity(int $fileId, bool $isDirectory): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setOrganizationCode('ORG1');
        $entity->setProjectId(900);
        $entity->setTaskId(700);
        $entity->setTopicId(800);
        $entity->setFileType('file');
        $entity->setFileName('demo.md');
        $entity->setFileExtension('md');
        $entity->setFileKey('/workspace/demo.md');
        $entity->setFileSize(1024);
        $entity->setExternalUrl('');
        $entity->setStorageType('workspace');
        $entity->setIsHidden(false);
        $entity->setIsDirectory($isDirectory);
        $entity->setSort(1);
        $entity->setParentId(1);
        $entity->setSource(0);
        $entity->setUpdatedAt('2026-04-23 12:00:00');

        return $entity;
    }
}
