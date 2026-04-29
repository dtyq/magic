<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperAgent\Service;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileManagementAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use ReflectionProperty;

/**
 * @internal
 */
class FileManagementAppServiceTest extends TestCase
{
    public function testDispatchFileUploadedEventUsesPersistedFileEntity(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->once())
            ->method('dispatch')
            ->with($this->callback(static function (object $event): bool {
                return $event instanceof FileUploadedEvent
                    && $event->getFileEntity()->getFileId() === 501
                    && $event->getFileEntity()->getFileKey() === '/workspace/hh.md'
                    && $event->getUserId() === 'U1'
                    && $event->getOrganizationCode() === 'ORG1';
            }))
            ->willReturnArgument(0);

        $this->createService($dispatcher)->dispatchOne(
            $this->createTaskFileEntity(501, '/workspace/hh.md'),
            $this->createAuthorization('U1', 'ORG1')
        );
    }

    public function testDispatchFileUploadedEventsDispatchesEveryPersistedFileAndSkipsNull(): void
    {
        $dispatchedFileIds = [];
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->exactly(2))
            ->method('dispatch')
            ->with($this->callback(static function (object $event) use (&$dispatchedFileIds): bool {
                if (! $event instanceof FileUploadedEvent) {
                    return false;
                }

                $dispatchedFileIds[] = $event->getFileEntity()->getFileId();
                return $event->getUserId() === 'U1'
                    && $event->getOrganizationCode() === 'ORG1';
            }))
            ->willReturnArgument(0);

        $this->createService($dispatcher)->dispatchMany(
            [
                $this->createTaskFileEntity(501, '/workspace/a.md'),
                null,
                $this->createTaskFileEntity(502, '/workspace/b.md'),
            ],
            $this->createAuthorization('U1', 'ORG1')
        );

        $this->assertSame([501, 502], $dispatchedFileIds);
    }

    public function testDispatchFilesBatchDeletedEventNormalizesFileIds(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->once())
            ->method('dispatch')
            ->with($this->callback(static function (object $event): bool {
                return $event instanceof FilesBatchDeletedEvent
                    && $event->getProjectId() === 900
                    && $event->getFileIds() === [501, 502]
                    && $event->getUserAuthorization()->getId() === 'U1'
                    && $event->getUserAuthorization()->getOrganizationCode() === 'ORG1';
            }))
            ->willReturnArgument(0);

        $this->createService($dispatcher)->dispatchBatchDeleted(
            900,
            [501, '502', 0, 501, -1],
            $this->createAuthorization('U1', 'ORG1')
        );
    }

    private function createService(EventDispatcherInterface $dispatcher): TestableFileManagementAppService
    {
        $reflectionClass = new ReflectionClass(TestableFileManagementAppService::class);
        /** @var TestableFileManagementAppService $service */
        $service = $reflectionClass->newInstanceWithoutConstructor();

        $eventDispatcherProperty = new ReflectionProperty(FileManagementAppService::class, 'eventDispatcher');
        $eventDispatcherProperty->setAccessible(true);
        $eventDispatcherProperty->setValue($service, $dispatcher);

        return $service;
    }

    private function createAuthorization(string $userId, string $organizationCode): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setId($userId)
            ->setOrganizationCode($organizationCode);
    }

    private function createTaskFileEntity(int $fileId, string $fileKey): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setFileKey($fileKey);
        $entity->setFileName(basename($fileKey));
        $entity->setIsDirectory(false);

        return $entity;
    }
}

class TestableFileManagementAppService extends FileManagementAppService
{
    public function dispatchOne(?TaskFileEntity $fileEntity, MagicUserAuthorization $authorization): void
    {
        $this->dispatchFileUploadedEvent($fileEntity, $authorization);
    }

    /**
     * @param array<int, null|TaskFileEntity> $fileEntities
     */
    public function dispatchMany(array $fileEntities, MagicUserAuthorization $authorization): void
    {
        $this->dispatchFileUploadedEvents($fileEntities, $authorization);
    }

    public function dispatchBatchDeleted(int $projectId, array $fileIds, MagicUserAuthorization $authorization): void
    {
        $this->dispatchFilesBatchDeletedEvent($projectId, $fileIds, $authorization);
    }
}
