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
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use ReflectionMethod;
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

    public function testDispatchFilesBatchDeletedEventSeparatesFilesAndDirectories(): void
    {
        $fileEntity = $this->createTaskFileEntity(501, '/workspace/a.md');
        $directoryEntity = $this->createTaskFileEntity(502, '/workspace/dir', true);

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->once())
            ->method('dispatch')
            ->with($this->callback(static function (object $event) use ($fileEntity, $directoryEntity): bool {
                return $event instanceof FilesBatchDeletedEvent
                    && $event->getProjectId() === 900
                    && $event->getFileEntities() === [$fileEntity]
                    && $event->getDirectoryEntities() === [$directoryEntity]
                    && $event->getFileIds() === [501, 502]
                    && $event->getUserId() === 'U1'
                    && $event->getOrganizationCode() === 'ORG1'
                    && $event->getUserAuthorization()->getId() === 'U1'
                    && $event->getUserAuthorization()->getOrganizationCode() === 'ORG1';
            }))
            ->willReturnArgument(0);

        $this->createService($dispatcher)->dispatchBatchDeleted(
            900,
            [$fileEntity, null, $directoryEntity],
            $this->createAuthorization('U1', 'ORG1')
        );
    }

    public function testDispatchFilesBatchDeletedEventSkipsWhenNoEntities(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $this->createService($dispatcher)->dispatchBatchDeleted(
            900,
            [null],
            $this->createAuthorization('U1', 'ORG1')
        );
    }

    public function testBuildRelativeFilePathUsesParentChain(): void
    {
        $directoryEntity = $this->createTaskFileEntity(100, 'DT001/user/project_900/workspace/docs', true);
        $directoryEntity->setFileName('docs');
        $directoryEntity->setParentId(0);
        $directoryEntity->setProjectId(900);

        $fileEntity = $this->createTaskFileEntity(101, 'DT001/user/project_900/workspace/image.png');
        $fileEntity->setFileName('image.png');
        $fileEntity->setParentId(100);
        $fileEntity->setProjectId(900);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getFilesWithParentsByIds')
            ->with([101], 900)
            ->willReturn([$fileEntity, $directoryEntity]);

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $method = new ReflectionMethod(FileManagementAppService::class, 'buildRelativeFilePathForEntity');
        $method->setAccessible(true);

        $this->assertSame('/docs/image.png', $method->invoke($service, $fileEntity, 900));
    }

    private function createService(EventDispatcherInterface $dispatcher): TestableFileManagementAppService
    {
        $reflectionClass = new ReflectionClass(TestableFileManagementAppService::class);
        /** @var TestableFileManagementAppService $service */
        $service = $reflectionClass->newInstanceWithoutConstructor();

        $this->setPrivateProperty($service, 'eventDispatcher', $dispatcher);

        return $service;
    }

    private function setPrivateProperty(TestableFileManagementAppService $service, string $propertyName, mixed $value): void
    {
        $property = new ReflectionProperty(FileManagementAppService::class, $propertyName);
        $property->setAccessible(true);
        $property->setValue($service, $value);
    }

    private function createAuthorization(string $userId, string $organizationCode): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setId($userId)
            ->setOrganizationCode($organizationCode);
    }

    private function createTaskFileEntity(int $fileId, string $fileKey, bool $isDirectory = false): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setFileKey($fileKey);
        $entity->setFileName(basename($fileKey));
        $entity->setFileExtension((string) pathinfo($fileKey, PATHINFO_EXTENSION));
        $entity->setIsDirectory($isDirectory);
        $entity->setSource(0);

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

    /**
     * @param array<int, null|TaskFileEntity> $entities
     */
    public function dispatchBatchDeleted(int $projectId, array $entities, MagicUserAuthorization $authorization): void
    {
        $this->dispatchFilesBatchDeletedEvent($projectId, $entities, $authorization);
    }
}
