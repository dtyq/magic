<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\File\Service;

use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\File\Service\FileManagementAppService;
use App\Application\SuperMagic\File\Service\OpenFileAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\DefaultFileDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\File\Service\FileTemporaryCredentialDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\UpsertProjectFileNodeDTO;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\OpenBatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UploadProjectFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use App\Interfaces\SuperMagic\File\Facade\OpenApi\OpenFileApi;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use Psr\SimpleCache\CacheInterface;
use ReflectionProperty;
use RuntimeException;
use Swow\Psr7\Message\UploadedFile;

/** @internal */
final class OpenFileUploadTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testBatchHeadUsesProjectStorageOrganizationAndReturnsEveryKey(): void
    {
        [$service, $repository] = $this->service();
        $repository->expects($this->exactly(3))->method('getHeadObjectByCredential')->willReturnCallback(static function (string $organization, string $key, StorageBucketType $bucket): array {
            self::assertSame('owner-org', $organization);
            self::assertSame(StorageBucketType::SandBox, $bucket);
            return match (basename($key)) {
                'good' => ['content_length' => 88],
                'missing' => throw new CloudFileException('not found', 404),
                default => throw new RuntimeException('timeout'),
            };
        });
        $filesDomain = (new ReflectionProperty(OpenFileAppService::class, 'taskFileDomainService'))->getValue($service);
        $filesDomain->expects($this->once())->method('upsertProjectFileNode')->willReturnCallback(function (UpsertProjectFileNodeDTO $dto): TaskFileEntity {
            $file = $dto->getTaskFileEntity();
            self::assertSame(88, $file->getFileSize());
            self::assertSame('user_upload', $file->getFileType());
            self::assertSame(0, $file->getTaskId());
            self::assertFalse($file->getIsDirectory());
            self::assertSame('owner-org', $dto->getProjectOrganizationCode());
            return $this->saved($file->getFileKey());
        });
        $files = array_map(fn (string $name): array => ['file_key' => $this->key($name), 'file_name' => $name . '.csv', 'file_size' => 1, 'task_id' => 'fake', 'is_directory' => true], ['good', 'missing', 'timeout']);
        $result = $service->batchSaveProjectFiles($this->context(), new OpenBatchSaveProjectFilesRequestDTO(['project_id' => '9', 'files' => $files]));
        self::assertSame(['file_id' => '1002', 'error' => ''], $result[$this->key('good')]);
        self::assertSame(['file_id' => '', 'error' => '文件尚未完成上传'], $result[$this->key('missing')]);
        self::assertSame(['file_id' => '', 'error' => '无法校验上传文件，请稍后重试'], $result[$this->key('timeout')]);
    }

    public function testInvalidScopeDoesNotPerformHeadOrSave(): void
    {
        [$service, $repository] = $this->service();
        $repository->expects($this->never())->method('getHeadObjectByCredential');
        $files = (new ReflectionProperty(OpenFileAppService::class, 'taskFileDomainService'))->getValue($service);
        $files->expects($this->never())->method('upsertProjectFileNode');
        $result = $service->batchSaveProjectFiles($this->context(), new OpenBatchSaveProjectFilesRequestDTO(['project_id' => '9', 'files' => [['file_key' => 'owner-org/project_99/workspace/other', 'file_name' => 'other']]]));
        self::assertSame('文件不属于当前项目上传范围', array_values($result)[0]['error']);
    }

    public function testEditorFailureStopsAllStorageWork(): void
    {
        [$service, $repository] = $this->service([], false);
        $repository->expects($this->never())->method('getHeadObjectByCredential');
        $files = (new ReflectionProperty(OpenFileAppService::class, 'taskFileDomainService'))->getValue($service);
        $files->expects($this->never())->method('upsertProjectFileNode');
        $this->expectException(BusinessException::class);
        $service->batchSaveProjectFiles($this->context(), new OpenBatchSaveProjectFilesRequestDTO(['project_id' => '9', 'files' => [['file_key' => $this->key('file'), 'file_name' => 'file']]]));
    }

    public function testKeyedBatchCommitsOnlyRecoverableItemsAndDispatchesAfterCommit(): void
    {
        [$service, $repository, $files, $events] = $this->service();
        $repository->method('getHeadObjectByCredential')->willReturn(['content_length' => 88]);
        $this->unitConnection->statement('CREATE TABLE registered (file_key TEXT)');
        $files->method('upsertProjectFileNode')->willReturnCallback(function (UpsertProjectFileNodeDTO $dto): TaskFileEntity {
            return $this->unitConnection->transaction(function () use ($dto): TaskFileEntity {
                $key = $dto->getTaskFileEntity()->getFileKey();
                $this->unitConnection->insert('INSERT INTO registered (file_key) VALUES (?)', [$key]);
                if (str_ends_with($key, '/bad')) {
                    throw new BusinessException('File conflict', SuperAgentErrorCode::FILE_EXIST->value);
                }
                return $this->saved($key);
            });
        });
        $events->expects($this->once())->method('dispatch')->willReturnCallback(function (object $event): object {
            self::assertSame(0, $this->unitConnection->transactionLevel());
            return $event;
        });
        $result = $service->batchSaveProjectFiles($this->context(), $this->openBatch());
        self::assertSame(['file_id' => '1002', 'error' => ''], $result[$this->key('good')]);
        self::assertSame(['file_id' => '', 'error' => 'File conflict'], $result[$this->key('bad')]);
        self::assertCount(1, $this->unitConnection->select('SELECT * FROM registered'));
    }

    public function testUnexpectedRegistrationFailureRollsBackEarlierItemsAndEmitsNothing(): void
    {
        [$service, $repository, $files, $events] = $this->service();
        $repository->method('getHeadObjectByCredential')->willReturn(['content_length' => 88]);
        $this->unitConnection->statement('CREATE TABLE registered (file_key TEXT)');
        $files->method('upsertProjectFileNode')->willReturnCallback(function (UpsertProjectFileNodeDTO $dto): TaskFileEntity {
            $key = $dto->getTaskFileEntity()->getFileKey();
            if (str_ends_with($key, '/bad')) {
                throw new RuntimeException('Connection lost');
            }
            $this->unitConnection->insert('INSERT INTO registered (file_key) VALUES (?)', [$key]);
            return $this->saved($key);
        });
        $events->expects($this->never())->method('dispatch');
        try {
            $service->batchSaveProjectFiles($this->context(), $this->openBatch());
            self::fail('Expected batch failure');
        } catch (BusinessException $exception) {
            self::assertSame(SuperAgentErrorCode::FILE_SAVE_FAILED->value, $exception->getCode());
        }
        self::assertSame([], $this->unitConnection->select('SELECT * FROM registered'));
        self::assertSame(0, $this->unitConnection->transactionLevel());
    }

    public function testLegacyBatchStillReturnsFileDtosInsteadOfKeyedResults(): void
    {
        [, , $files, , , $service] = $this->service();
        $entity = $this->saved($this->key('good'));
        $files->method('upsertProjectFileNode')->willReturn($entity);
        $files->method('getFilesWithParentsByIds')->willReturn([$entity]);
        $result = $service->batchSaveFiles($this->context(), BatchSaveProjectFilesRequestDTO::fromRequest(['project_id' => '9', 'files' => [['file_key' => $this->key('good'), 'file_name' => 'good.csv']]]));
        self::assertCount(1, $result);
        self::assertInstanceOf(TaskFileItemDTO::class, $result[0]);
        self::assertArrayHasKey('relative_file_path', $result[0]->toArray());
    }

    public function testSaveFailureDoesNotDeleteAnObjectWithUncertainCommitState(): void
    {
        [$service, $repository, $files, $events] = $this->service();
        $repository->expects($this->once())->method('uploadByCredential');
        $files->method('upsertProjectFileNode')->willReturn($this->saved($this->key('uploaded')));
        $repository->expects($this->never())->method('deleteObjectsByCredential');
        $cause = new RuntimeException('Post-commit event failed');
        $events->method('dispatch')->willThrowException($cause);
        $this->expectExceptionObject($cause);
        $service->uploadProjectFile($this->context(), new UploadProjectFileRequestDTO(['project_id' => '9']), $this->uploaded(4));
    }

    #[DataProvider('uploadSizes')]
    public function testUploadUsesActualSizeAtTheConfiguredBoundary(int $size, bool $allowed): void
    {
        [$service, $uploads, $files] = $this->service();
        $file = $this->uploaded($size);
        if (! $allowed) {
            $uploads->expects($this->never())->method('uploadByCredential');
            $files->expects($this->never())->method('upsertProjectFileNode');
            $this->expectException(BusinessException::class);
        } else {
            $uploads->expects($this->once())->method('uploadByCredential')->with('owner-org', $this->callback(fn (UploadFile $upload): bool => str_starts_with($upload->getKeyPath(), $this->key(''))), StorageBucketType::SandBox, false);
            $files->expects($this->once())->method('upsertProjectFileNode')->with($this->callback(static fn (UpsertProjectFileNodeDTO $dto): bool => $dto->getTaskFileEntity()->getFileSize() === $size && $dto->getTaskFileEntity()->getFileName() === 'upload.pdf'))->willReturn($this->saved($this->key('uploaded')));
        }
        $result = $service->uploadProjectFile($this->context(), new UploadProjectFileRequestDTO(['project_id' => '9']), $file);
        if ($allowed) {
            self::assertSame('1002', $result['file_id']);
        }
    }

    public static function uploadSizes(): array
    {
        return [[50 * 1024 * 1024, true], [50 * 1024 * 1024 + 1, false]];
    }

    public function testFacadeRemovesOnlyRelativePathFromUploadResponse(): void
    {
        $file = $this->uploaded(4);
        $request = $this->requestWithData(['project_id' => '9']);
        $request->method('file')->willReturn($file);
        [$service, , $files, , , $internal] = $this->service();
        $entity = $this->saved($this->key('uploaded'));
        $entity->setFileName('upload.pdf');
        $files->method('upsertProjectFileNode')->willReturn($entity);
        RequestCoContext::setUserAuthorization($this->authorization());
        $result = (new OpenFileApi($request, $internal, $service))->uploadProjectFile($this->context());
        self::assertArrayNotHasKey('relative_file_path', $result);
        self::assertSame('upload.pdf', $result['file_name']);
        self::assertSame($this->key('uploaded'), $result['file_key']);
    }

    public function testStsChecksEditorBeforeIssuingCredentials(): void
    {
        [$service, $repository] = $this->service();
        $repository->expects($this->once())->method('getStsTemporaryCredential')->with('owner-org', StorageBucketType::SandBox, '/project_9/workspace', 3600, false, [])->willReturn(['platform' => 'tos', 'token' => 'test']);
        self::assertSame(['platform' => 'tos', 'token' => 'test', 'magic_service_host' => ''], $service->getProjectUploadToken($this->context(), ProjectUploadTokenRequestDTO::fromRequest(['project_id' => '9'])));
    }

    public function testStsDenialNeverCallsTheCredentialDomainService(): void
    {
        [$service, $repository] = $this->service([], false);
        $repository->expects($this->never())->method('getStsTemporaryCredential');
        $this->expectException(BusinessException::class);
        $service->getProjectUploadToken($this->context(), ProjectUploadTokenRequestDTO::fromRequest(['project_id' => '9']));
    }

    #[DataProvider('temporaryProjectIds')]
    public function testStsWithoutProjectPreservesTemporaryUploadScope(string $projectId): void
    {
        [$service, $repository] = $this->service();
        $service->expects($this->never())->method('getAccessibleProjectWithEditor');
        $repository->expects($this->once())->method('getStsTemporaryCredential')->with(
            'caller-org',
            StorageBucketType::SandBox,
            $this->callback(static fn (string $dir): bool => str_starts_with($dir, '/project_') && str_ends_with($dir, '/workspace')),
            3600,
            false,
            [],
        )->willReturn(['platform' => 'tos', 'token' => 'temporary']);
        $result = $service->getProjectUploadToken($this->context(), ProjectUploadTokenRequestDTO::fromRequest(['project_id' => $projectId]));
        self::assertSame('temporary', $result['token']);
    }

    public static function temporaryProjectIds(): array
    {
        return [[''], ['0']];
    }

    public function testOpenBatchRechecksPermissionAndReleasesLockBeforeAnyRegistration(): void
    {
        [$service, $repository, $files] = $this->service([], true, true);
        $repository->method('getHeadObjectByCredential')->willReturn(['content_length' => 88]);
        $files->expects($this->never())->method('upsertProjectFileNode');
        $locker = (new ReflectionProperty(OpenFileAppService::class, 'locker'))->getValue($service);
        $locker->expects($this->once())->method('release');
        $this->expectException(BusinessException::class);
        $service->batchSaveProjectFiles($this->context(), $this->openBatch());
    }

    public function testPostCommitEventFailureKeepsCommittedFileRecords(): void
    {
        [$service, $repository, $files, $events] = $this->service();
        $repository->method('getHeadObjectByCredential')->willReturn(['content_length' => 88]);
        $this->unitConnection->statement('CREATE TABLE registered (file_key TEXT)');
        $files->method('upsertProjectFileNode')->willReturnCallback(function (UpsertProjectFileNodeDTO $dto): TaskFileEntity {
            $key = $dto->getTaskFileEntity()->getFileKey();
            $this->unitConnection->insert('INSERT INTO registered (file_key) VALUES (?)', [$key]);
            return $this->saved($key);
        });
        $events->method('dispatch')->willThrowException(new RuntimeException('Event dispatch failed'));
        try {
            $service->batchSaveProjectFiles($this->context(), $this->openBatch());
            self::fail('Expected post-commit event failure');
        } catch (BusinessException $exception) {
            self::assertSame(SuperAgentErrorCode::FILE_SAVE_FAILED->value, $exception->getCode());
        }
        self::assertCount(2, $this->unitConnection->select('SELECT * FROM registered'));
        self::assertSame(0, $this->unitConnection->transactionLevel());
    }

    public function testLocalStsProtocolIsPreservedForTheExistingFileApplicationService(): void
    {
        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $repository->method('getStsTemporaryCredential')->willReturn([
            'platform' => 'local', 'temporary_credential' => ['dir' => 'project_9/workspace/'], 'expires' => time() + 3600,
        ]);
        $cache = $this->createMock(CacheInterface::class);
        $cache->expects($this->once())->method('set')->with(
            $this->callback(static fn (string $key): bool => str_starts_with($key, 'local_credential:')),
            ['organization_code' => 'owner-org'],
            $this->callback(static fn (int $ttl): bool => $ttl > 3500 && $ttl <= 3600),
        )->willReturn(true);
        $domain = new FileDomainService($repository);
        $application = new FileAppService($domain, $this->createMock(DefaultFileDomainService::class), $cache, new FileTemporaryCredentialDomainService($domain, $cache));
        $result = $application->getStsTemporaryCredentialV2('owner-org', StorageBucketType::SandBox->value);
        self::assertSame('owner-org/project_9/workspace/', $result['temporary_credential']['dir']);
        self::assertStringStartsWith('local_credential:', $result['temporary_credential']['credential']);
        self::assertArrayHasKey('host', $result['temporary_credential']);
        self::assertArrayHasKey('read_host', $result['temporary_credential']);
        self::assertArrayHasKey('magic_service_host', $result);
    }

    private function service(array $methods = [], bool $authorized = true, bool $recheckDenied = false): array
    {
        $service = $this->getMockBuilder(OpenFileAppService::class)->disableOriginalConstructor()->onlyMethods(['getAccessibleProjectWithEditor'])->getMock();
        $internal = $this->getMockBuilder(FileManagementAppService::class)->disableOriginalConstructor()->onlyMethods(array_merge(['getAccessibleProjectWithEditor'], $methods))->getMock();
        $project = (new ProjectEntity())->setId(9)->setUserOrganizationCode('owner-org')->setWorkDir('/project_9/workspace');
        foreach ([$service, $internal] as $application) {
            if ($authorized) {
                $checks = 0;
                $application->method('getAccessibleProjectWithEditor')->with(9, 'caller', 'caller-org')->willReturnCallback(static function () use ($project, $recheckDenied, &$checks): ProjectEntity {
                    if ($recheckDenied && ++$checks > 1) {
                        throw new BusinessException('Forbidden', SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value);
                    }
                    return $project;
                });
            } else {
                $application->method('getAccessibleProjectWithEditor')->willThrowException(new BusinessException('Forbidden', SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value));
            }
        }
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('getFullPrefix')->with('owner-org')->willReturn('owner-org/');
        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $events = $this->createMock(EventDispatcherInterface::class);
        $locker = $this->createMock(LockerInterface::class);
        $locker->method('spinLock')->willReturn(true);
        $credentials = new FileTemporaryCredentialDomainService(new FileDomainService($repository), $this->createMock(CacheInterface::class));
        $dependencies = ['taskFileDomainService' => $files, 'fileDomainService' => new FileDomainService($repository), 'eventDispatcher' => $events, 'locker' => $locker, 'logger' => new NullLogger()];
        $this->inject($internal, FileManagementAppService::class, $dependencies);
        $this->inject($service, OpenFileAppService::class, $dependencies + ['temporaryCredentialDomainService' => $credentials]);
        return [$service, $repository, $files, $events, $repository, $internal];
    }

    private function context(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($this->authorization());
        return $context;
    }

    private function key(string $name): string
    {
        return 'owner-org/project_9/workspace/' . $name;
    }

    private function openBatch(): OpenBatchSaveProjectFilesRequestDTO
    {
        return OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '9', 'files' => [['file_key' => $this->key('good'), 'file_name' => 'good.csv', 'file_size' => 88], ['file_key' => $this->key('bad'), 'file_name' => 'bad.csv', 'file_size' => 99]]]));
    }

    private function saved(string $key): TaskFileEntity
    {
        return new TaskFileEntity(['file_id' => 1002, 'project_id' => 9, 'file_key' => $key, 'file_name' => 'good.csv', 'file_size' => 88, 'source' => 0]);
    }

    private function uploaded(int $size): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'magic-open-upload-');
        $stream = fopen($path, 'wb');
        ftruncate($stream, $size);
        fclose($stream);
        return new UploadedFile($path, 1, UPLOAD_ERR_OK, 'upload.pdf');
    }
}
