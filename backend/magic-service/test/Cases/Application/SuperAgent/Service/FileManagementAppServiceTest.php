<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperAgent\Service;

use App\Application\SuperMagic\File\Event\Publish\FileBatchCopyPublisher;
use App\Application\SuperMagic\File\Service\FileManagementAppService;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Entity\FileCollectionItemEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\FilesBatchDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\FileCollectionDomainService;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\FileBatchOperationStatusManager;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchCopyFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchDeleteFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\CreateFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UpdateFileSourceRequestDTO;
use Hyperf\Amqp\Message\ProducerMessage;
use Hyperf\Amqp\Producer;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class FileManagementAppServiceTest extends TestCase
{
    private ?ContainerInterface $originalContainer = null;

    private bool $hadContainer = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->hadContainer = ApplicationContext::hasContainer();
        $this->originalContainer = $this->hadContainer ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        if ($this->hadContainer && $this->originalContainer !== null) {
            ApplicationContext::setContainer($this->originalContainer);
        } elseif (! $this->hadContainer) {
            $containerProperty = new ReflectionProperty(ApplicationContext::class, 'container');
            $containerProperty->setAccessible(true);
            $containerProperty->setValue(null, null);
        }

        parent::tearDown();
    }

    public function testCreateFileRejectsParentDirectoryOutsideAuthorizedProject(): void
    {
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getDirectoryByIdAndProject')
            ->with(901, 900)
            ->willReturn(null);

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->never())->method('createFile');

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new CreateFileRequestDTO();
        $requestDTO->projectId = '900';
        $requestDTO->parentId = '901';
        $requestDTO->fileName = 'forbidden.txt';
        $requestDTO->isDirectory = false;

        $this->expectException(BusinessException::class);
        $service->createFile($requestContext, $requestDTO);
    }

    public function testCreateFileMarksNonDirectoryFileAsUserCreate(): void
    {
        $parentDir = $this->createTaskFileEntity(901, '/workspace/docs', true);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getDirectoryByIdAndProject')
            ->with(901, 900)
            ->willReturn($parentDir);
        $taskFileDomainService->method('getFilesWithParentsByIds')->willReturn([]);

        $createdEntity = $this->createTaskFileEntity(502, '/workspace/docs/new.txt');
        $createdEntity->setParentId(901);
        $createdEntity->setFileType(FileType::USER_CREATE->value);

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('createFile')
            ->with('new.txt', '901', false, null, null, FileType::USER_CREATE, TaskFileSource::PROJECT_DIRECTORY, null, false, 0)
            ->willReturn($createdEntity);

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new CreateFileRequestDTO();
        $requestDTO->projectId = '900';
        $requestDTO->parentId = '901';
        $requestDTO->fileName = 'new.txt';
        $requestDTO->isDirectory = false;

        $result = $service->createFile($requestContext, $requestDTO);

        $this->assertSame(FileType::USER_CREATE->value, $result['file_type']);
    }

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

    public function testDispatchFileUploadedEventSkipsUserSpaceFile(): void
    {
        $fileEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $this->createService($dispatcher)->dispatchOne(
            $fileEntity,
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

    public function testDispatchFilesBatchDeletedEventSkipsUserSpaceFiles(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $this->createService($dispatcher)->dispatchBatchDeleted(
            0,
            [$this->createUserSpaceFileEntity(501, '/user/memory.md')],
            $this->createAuthorization('U1', 'ORG1')
        );
    }

    public function testDeleteFileAllowsOwnedUserSpaceFileWithoutProjectLookup(): void
    {
        $fileEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('getFileById')
            ->with('501')
            ->willReturn($fileEntity);
        $magicFSFileDomainService->expects($this->once())
            ->method('deleteFile')
            ->with('501');

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $service = $this->createService($dispatcher);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));

        $this->assertSame(['file_id' => 501], $service->deleteFile($requestContext, 501));
    }

    public function testBatchDeleteFilesUsesAuthorizedProjectScopeAndNormalizesDuplicateIds(): void
    {
        $file501 = $this->createTaskFileEntity(501, '/workspace/a.md');
        $file502 = $this->createTaskFileEntity(502, '/workspace/b.md');
        $file501->setProjectId(900);
        $file502->setProjectId(900);

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('deleteFiles')
            ->with([501, 502], false, 900)
            ->willReturn([$file501, $file502]);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getProjectFilesByIds')
            ->with(900, [501, 502])
            ->willReturn([$file501, $file502]);

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new BatchDeleteFilesRequestDTO();
        $requestDTO->projectId = '900';
        $requestDTO->fileIds = [501, 501, 502];

        $this->assertSame([
            'project_id' => 900,
            'file_ids' => [501, 502],
            'count' => 2,
        ], $service->batchDeleteFiles($requestContext, $requestDTO));
    }

    public function testBatchDeleteFilesAllowsOwnedUserSpaceFilesWithoutProjectLookup(): void
    {
        $file501 = $this->createUserSpaceFileEntity(501, '/user/a.md');
        $file502 = $this->createUserSpaceFileEntity(502, '/user/b.md');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getFilesByIds')
            ->with([501, 502])
            ->willReturn([$file501, $file502]);

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('deleteFiles')
            ->with([501, 502], false, 0)
            ->willReturn([$file501, $file502]);

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $service = $this->createService($dispatcher);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new BatchDeleteFilesRequestDTO();
        $requestDTO->projectId = '0';
        $requestDTO->fileIds = [501, 501, 502];

        $this->assertSame([
            'project_id' => 0,
            'file_ids' => [501, 502],
            'count' => 2,
        ], $service->batchDeleteFiles($requestContext, $requestDTO));
    }

    public function testRenameFileAllowsOwnedUserSpaceFileWithoutProjectLookup(): void
    {
        $fileEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');
        $renamedEntity = $this->createUserSpaceFileEntity(501, '/user/profile.md');

        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('getFileById')
            ->with('501')
            ->willReturn($fileEntity);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('renameFileWithCheck')
            ->with('501', 'profile.md')
            ->willReturn($renamedEntity);

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $service = $this->createService($dispatcher);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));

        $result = $service->renameFile($requestContext, 501, 'profile.md');

        $this->assertSame('501', $result['file_id']);
        $this->assertSame('profile.md', $result['file_name']);
    }

    public function testUpdateFileSourceAllowsOwnedUserSpaceFileWithoutProjectLookup(): void
    {
        $fileEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');
        $updatedEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');
        $updatedEntity->setSource(2);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(501)
            ->willReturn($fileEntity);
        $taskFileDomainService->expects($this->once())
            ->method('updateFileSource')
            ->with(501, TaskFileSource::PROJECT_DIRECTORY)
            ->willReturn($updatedEntity);

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new UpdateFileSourceRequestDTO();
        $requestDTO->fileId = 501;
        $requestDTO->source = 2;

        $this->assertSame(
            ['file_id' => 501, 'source' => 2],
            $service->updateFileSource($requestContext, $requestDTO)
        );
    }

    public function testUpdateFileSourceRejectsUserSpaceFileOwnedByAnotherUser(): void
    {
        $fileEntity = $this->createUserSpaceFileEntity(501, '/user/memory.md');
        $fileEntity->setUserId('U2');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(501)
            ->willReturn($fileEntity);
        $taskFileDomainService->expects($this->never())->method('updateFileSource');

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new UpdateFileSourceRequestDTO();
        $requestDTO->fileId = 501;
        $requestDTO->source = 2;

        $this->expectException(BusinessException::class);
        $service->updateFileSource($requestContext, $requestDTO);
    }

    public function testUpdateFileSourceRejectsProjectFileWithoutProjectAccess(): void
    {
        // TestableFileManagementAppService::getAccessibleProject 直接抛异常，
        // 模拟当前用户对文件所属项目无访问权限的场景。
        $fileEntity = $this->createTaskFileEntity(501, '/workspace/hh.md');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(501)
            ->willReturn($fileEntity);
        $taskFileDomainService->expects($this->never())->method('updateFileSource');

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new UpdateFileSourceRequestDTO();
        $requestDTO->fileId = 501;
        $requestDTO->source = 2;

        $this->expectException(BusinessException::class);
        $service->updateFileSource($requestContext, $requestDTO);
    }

    public function testUpdateFileSourceThrowsWhenFileNotFound(): void
    {
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(999)
            ->willReturn(null);
        $taskFileDomainService->expects($this->never())->method('updateFileSource');

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new UpdateFileSourceRequestDTO();
        $requestDTO->fileId = 999;
        $requestDTO->source = 2;

        $this->expectException(BusinessException::class);
        $service->updateFileSource($requestContext, $requestDTO);
    }

    public function testBatchDeleteFilesDoesNotDispatchEventWhenDomainRejectsProjectScope(): void
    {
        $magicFSFileDomainService = $this->createMock(MagicFSFileDomainService::class);
        $magicFSFileDomainService->expects($this->once())
            ->method('deleteFiles')
            ->with([501, 999], false, 900)
            ->willThrowException(new BusinessException('file.permission_denied', 51150));

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects($this->never())->method('dispatch');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getProjectFilesByIds')
            ->with(900, [501, 999])
            ->willReturn([]);

        $service = $this->createService($dispatcher);
        $this->setPrivateProperty($service, 'magicFSFileDomainService', $magicFSFileDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new BatchDeleteFilesRequestDTO();
        $requestDTO->projectId = '900';
        $requestDTO->fileIds = [501, 999];

        $this->expectExceptionCode(51150);
        $service->batchDeleteFiles($requestContext, $requestDTO);
    }

    public function testBatchCopyFilePublishesEffectivePreserveParentPathForCrossProjectCopy(): void
    {
        $sourceFile = $this->createTaskFileEntity(501, '/workspace/a/1/2.txt');
        $sourceFile->setProjectId(900);
        $targetParent = $this->createTaskFileEntity(700, '/workspace/b', true);
        $targetParent->setProjectId(901);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getProjectFilesByIds')
            ->with(900, ['501'])
            ->willReturn([$sourceFile]);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(700)
            ->willReturn($targetParent);

        $statusManager = $this->createMock(FileBatchOperationStatusManager::class);
        $statusManager->expects($this->once())
            ->method('generateBatchKey')
            ->with(
                FileBatchOperationStatusManager::OPERATION_COPY,
                'U1',
                md5('900:901:700:501')
            )
            ->willReturn('batch-copy');
        $statusManager->method('initializeTask')->willReturn(true);

        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->callback(static function (object $publisher): bool {
                if (! $publisher instanceof FileBatchCopyPublisher) {
                    return false;
                }
                $property = new ReflectionProperty(ProducerMessage::class, 'payload');
                $payload = $property->getValue($publisher);
                return ($payload['preserve_parent_path'] ?? false) === true;
            }));

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);
        $this->setPrivateProperty($service, 'batchOperationStatusManager', $statusManager);
        $this->setPrivateProperty($service, 'producer', $producer);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));
        $requestDTO = new BatchCopyFileRequestDTO([
            'file_ids' => ['501'],
            'project_id' => '900',
            'target_project_id' => '901',
            'target_parent_id' => '700',
            'preserve_parent_path' => true,
        ]);

        $service->batchCopyFile($requestContext, $requestDTO);
    }

    public function testBatchCopyAuthorizedFilesUsesAuthorizedScopeAndTargetContextInBatchKey(): void
    {
        $sourceProject = new ProjectEntity([
            'id' => 900,
            'user_id' => 'OWNER',
            'user_organization_code' => 'SOURCE_ORG',
        ]);
        $targetProject = new ProjectEntity([
            'id' => 901,
            'user_id' => 'U1',
            'user_organization_code' => 'ORG1',
        ]);
        $targetParent = $this->createTaskFileEntity(700, '/workspace/b', true);
        $targetParent->setProjectId(901);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getById')
            ->with(700)
            ->willReturn($targetParent);

        $statusManager = $this->createMock(FileBatchOperationStatusManager::class);
        $statusManager->expects($this->once())
            ->method('generateBatchKey')
            ->with(
                FileBatchOperationStatusManager::OPERATION_COPY,
                'U1',
                md5('900:901:700:501,502')
            )
            ->willReturn('shared-batch-copy');
        $statusManager->method('initializeTask')->willReturn(true);

        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->callback(static function (object $publisher): bool {
                if (! $publisher instanceof FileBatchCopyPublisher) {
                    return false;
                }
                $property = new ReflectionProperty(ProducerMessage::class, 'payload');
                $payload = $property->getValue($publisher);
                return ($payload['file_ids'] ?? []) === [501, 502]
                    && ($payload['source_project_id'] ?? null) === 900
                    && ($payload['target_project_id'] ?? null) === 901;
            }));

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);
        $this->setPrivateProperty($service, 'batchOperationStatusManager', $statusManager);
        $this->setPrivateProperty($service, 'producer', $producer);

        $result = $service->batchCopyAuthorizedFiles(
            $this->createAuthorization('U1', 'ORG1'),
            $sourceProject,
            $targetProject,
            [502, 501, 502],
            '700',
            '',
            [],
            true
        );

        self::assertSame('shared-batch-copy', $result['batch_key']);
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

    public function testGetFileUrlsAllowsUserSpaceFileWithoutProjectLookup(): void
    {
        $fileEntity = $this->createTaskFileEntity(501, '/user/memory.md');
        $fileEntity->setProjectId(0);
        $fileEntity->setSpaceType('user');
        $fileEntity->setUserId('U1');
        $fileEntity->setOrganizationCode('ORG1');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getFilesByIds')
            ->with([501])
            ->willReturn([$fileEntity]);
        $taskFileDomainService->expects($this->once())
            ->method('getFileUrls')
            ->with('ORG1', 0, ['501'], 'preview', [], [], true)
            ->willReturn([['file_id' => '501', 'url' => 'https://example.test/memory.md']]);

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($this->createAuthorization('U1', 'ORG1'));

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')
            ->with('error_message')
            ->willReturn([]);

        ApplicationContext::setContainer(new class($this->createMock(TranslatorInterface::class), $config) implements ContainerInterface {
            public function __construct(
                private readonly TranslatorInterface $translator,
                private readonly ConfigInterface $config,
            ) {
            }

            public function get(string $id): mixed
            {
                if ($id === TranslatorInterface::class) {
                    return $this->translator;
                }

                if ($id === ConfigInterface::class) {
                    return $this->config;
                }

                throw new RuntimeException("Container binding not found for {$id}");
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class || $id === ConfigInterface::class;
            }
        });

        $this->assertSame(
            [['file_id' => '501', 'url' => 'https://example.test/memory.md']],
            $service->getFileUrls($requestContext, [501], 'preview')
        );
    }

    public function testGetFileUrlsByAccessTokenFiltersFileCollectionScope(): void
    {
        $this->bindAccessToken('token-file-collection', 'share-file-collection');

        $shareEntity = (new ResourceShareEntity())
            ->setResourceId('77')
            ->setResourceType(ResourceType::FileCollection->value);

        $resourceShareDomainService = $this->createMock(ResourceShareDomainService::class);
        $resourceShareDomainService->expects($this->once())
            ->method('getValidShareById')
            ->with('share-file-collection')
            ->willReturn($shareEntity);

        $collectionItem = (new FileCollectionItemEntity())->setFileId('501');
        $fileCollectionDomainService = $this->createMock(FileCollectionDomainService::class);
        $fileCollectionDomainService->expects($this->once())
            ->method('getProjectIdByCollectionId')
            ->with(77)
            ->willReturn(900);
        $fileCollectionDomainService->method('getFilesByCollectionId')
            ->willReturnCallback(static fn (int $collectionId): array => $collectionId === 77 ? [$collectionItem] : []);

        $allowedFileEntity = $this->createTaskFileEntity(501, '/workspace/shared.md');
        $allowedFileEntity->setProjectId(900);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->method('findFilesByProjectIdAndIds')
            ->willReturnCallback(static fn (int $projectId, array $ids): array => $projectId === 900 && $ids === [501] ? [$allowedFileEntity] : []);
        $taskFileDomainService->method('getFileUrlsByProjectId')
            ->willReturnCallback(static function (array $ids, int $projectId): array {
                return array_map(
                    static fn (int $id): array => ['file_id' => (string) $id, 'url' => sprintf('https://example.test/%d.md', $id)],
                    $ids
                );
            });

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'resourceShareDomainService', $resourceShareDomainService);
        $this->setPrivateProperty($service, 'fileCollectionDomainService', $fileCollectionDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $this->assertSame(
            [['file_id' => '501', 'url' => 'https://example.test/501.md']],
            $service->getFileUrlsByAccessToken([501, 999], 'token-file-collection', 'preview')
        );
    }

    public function testGetFileUrlsByAccessTokenAllowsProjectScopeForTopicWhenViewFileListEnabledByDefault(): void
    {
        $this->bindAccessToken('token-topic', 'share-topic');

        $shareEntity = (new ResourceShareEntity())
            ->setResourceId('88')
            ->setResourceType(ResourceType::Topic->value);

        $resourceShareDomainService = $this->createMock(ResourceShareDomainService::class);
        $resourceShareDomainService->expects($this->once())
            ->method('getValidShareById')
            ->with('share-topic')
            ->willReturn($shareEntity);

        $topicEntity = new TopicEntity([
            'id' => 88,
            'project_id' => 900,
        ]);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $topicDomainService->expects($this->once())
            ->method('getTopicWithDeleted')
            ->with(88)
            ->willReturn($topicEntity);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->never())
            ->method('findUserFilesByTopicId');
        $taskFileDomainService->method('getFileUrlsByProjectId')
            ->willReturnCallback(static function (array $ids, int $projectId): array {
                return array_map(
                    static fn (int $id): array => ['file_id' => (string) $id, 'url' => sprintf('https://example.test/%d.md', $id)],
                    $ids
                );
            });

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'resourceShareDomainService', $resourceShareDomainService);
        $this->setPrivateProperty($service, 'topicDomainService', $topicDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $this->assertSame(
            [
                ['file_id' => '501', 'url' => 'https://example.test/501.md'],
                ['file_id' => '999', 'url' => 'https://example.test/999.md'],
            ],
            $service->getFileUrlsByAccessToken([501, 999], 'token-topic', 'preview')
        );
    }

    public function testGetFileUrlsByAccessTokenFiltersTopicScopeWhenViewFileListDisabled(): void
    {
        $this->bindAccessToken('token-topic-disabled-file-list', 'share-topic-disabled-file-list');

        $shareEntity = (new ResourceShareEntity())
            ->setResourceId('88')
            ->setResourceType(ResourceType::Topic->value)
            ->setExtra([CreateShareRequestDTO::EXTRA_FIELD_VIEW_FILE_LIST => false]);

        $resourceShareDomainService = $this->createMock(ResourceShareDomainService::class);
        $resourceShareDomainService->expects($this->once())
            ->method('getValidShareById')
            ->with('share-topic-disabled-file-list')
            ->willReturn($shareEntity);

        $topicEntity = new TopicEntity([
            'id' => 88,
            'project_id' => 900,
        ]);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $topicDomainService->expects($this->once())
            ->method('getTopicWithDeleted')
            ->with(88)
            ->willReturn($topicEntity);

        $visibleFileEntity = $this->createTaskFileEntity(501, '/workspace/topic.md');
        $visibleFileEntity->setProjectId(900);
        $visibleFileEntity->setTopicId(88);

        $hiddenTopicEntity = $this->createTaskFileEntity(777, '/runtime/topic_88/message/tool.md');
        $hiddenTopicEntity->setProjectId(900);
        $hiddenTopicEntity->setTopicId(88);
        $hiddenTopicEntity->setIsHidden(true);
        $hiddenTopicEntity->setStorageType(StorageType::TOPIC);

        $otherTopicEntity = $this->createTaskFileEntity(778, '/workspace/other-topic.md');
        $otherTopicEntity->setProjectId(900);
        $otherTopicEntity->setTopicId(99);

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->never())
            ->method('findUserFilesByTopicId');
        $taskFileDomainService->method('findFilesByProjectIdAndIds')
            ->willReturnCallback(static function (int $projectId, array $ids) use ($visibleFileEntity, $hiddenTopicEntity, $otherTopicEntity): array {
                if ($projectId !== 900 || $ids !== [501, 777, 778, 779]) {
                    return [];
                }

                return [$visibleFileEntity, $hiddenTopicEntity, $otherTopicEntity];
            });
        $taskFileDomainService->method('getFileUrlsByProjectId')
            ->willReturnCallback(static function (array $ids, int $projectId): array {
                return array_map(
                    static fn (int $id): array => ['file_id' => (string) $id, 'url' => sprintf('https://example.test/%d.md', $id)],
                    $ids
                );
            });

        $service = $this->createService($this->createMock(EventDispatcherInterface::class));
        $this->setPrivateProperty($service, 'resourceShareDomainService', $resourceShareDomainService);
        $this->setPrivateProperty($service, 'topicDomainService', $topicDomainService);
        $this->setPrivateProperty($service, 'taskFileDomainService', $taskFileDomainService);

        $this->assertSame(
            [
                ['file_id' => '501', 'url' => 'https://example.test/501.md'],
                ['file_id' => '777', 'url' => 'https://example.test/777.md'],
            ],
            $service->getFileUrlsByAccessToken([501, 777, 778, 779], 'token-topic-disabled-file-list', 'preview')
        );
    }

    private function createService(EventDispatcherInterface $dispatcher): TestableFileManagementAppService
    {
        $reflectionClass = new ReflectionClass(TestableFileManagementAppService::class);
        /** @var TestableFileManagementAppService $service */
        $service = $reflectionClass->newInstanceWithoutConstructor();

        $this->setPrivateProperty($service, 'eventDispatcher', $dispatcher);
        $this->setPrivateProperty($service, 'logger', $this->createMock(LoggerInterface::class));

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
            ->setOrganizationCode($organizationCode)
            ->setUserType(UserType::Human);
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
        $entity->setProjectId(900);

        return $entity;
    }

    private function createUserSpaceFileEntity(int $fileId, string $fileKey, bool $isDirectory = false): TaskFileEntity
    {
        $entity = $this->createTaskFileEntity($fileId, $fileKey, $isDirectory);
        $entity->setProjectId(0);
        $entity->setSpaceType('user');
        $entity->setUserId('U1');
        $entity->setOrganizationCode('ORG1');

        return $entity;
    }

    private function bindAccessToken(string $token, string $shareId): void
    {
        $redis = new FileManagementAccessTokenRedis([
            'super_magic_access_token:' . $token => json_encode([
                'share_id' => $shareId,
                'scope' => 'read',
                'created_at' => time(),
                'expires_at' => time() + 3600,
                'metadata' => [],
                'organization_code' => 'ORG1',
            ], JSON_THROW_ON_ERROR),
        ]);

        ApplicationContext::setContainer(new FileManagementAccessTokenTestContainer(
            $redis,
            $this->originalContainer
        ));
    }
}

final class FileManagementAccessTokenRedis extends Redis
{
    /**
     * @param array<string, string> $tokenValues
     */
    public function __construct(private readonly array $tokenValues)
    {
    }

    public function __call($name, $arguments)
    {
        if ($name === 'get') {
            return $this->tokenValues[(string) ($arguments[0] ?? '')] ?? null;
        }

        throw new RuntimeException("Redis command {$name} is not supported in this test");
    }
}

final readonly class FileManagementAccessTokenTestContainer implements ContainerInterface
{
    public function __construct(
        private Redis $redis,
        private ?ContainerInterface $fallbackContainer = null
    ) {
    }

    public function get(string $id): mixed
    {
        if ($id === Redis::class) {
            return $this->redis;
        }

        if ($this->fallbackContainer !== null) {
            return $this->fallbackContainer->get($id);
        }

        throw new RuntimeException("Container binding not found for {$id}");
    }

    public function has(string $id): bool
    {
        return $id === Redis::class || ($this->fallbackContainer !== null && $this->fallbackContainer->has($id));
    }
}

class TestableFileManagementAppService extends FileManagementAppService
{
    public function getAccessibleProject(int $projectId, string $userId, string $organizationCode, MemberRole $requiredRole = MemberRole::VIEWER): ProjectEntity
    {
        throw new BusinessException('project lookup should not run for user-space files');
    }

    public function getAccessibleProjectWithEditor(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        if ($projectId <= 0) {
            throw new BusinessException('project lookup should not run for user-space files');
        }

        return new ProjectEntity(['id' => $projectId, 'user_id' => $userId, 'user_organization_code' => $organizationCode]);
    }

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
