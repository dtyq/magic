<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use HyperfTest\Stub\Domain\SuperMagic\File\ArrayRowConnectionStub;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * Uses the real MagicFS update flow with isolated storage boundaries.
 * @internal
 */
class TaskFileContentCacheTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    private TaskFileEntity $storedFile;

    /** @var TaskFileEntity[] */
    private array $snapshots = [];

    private string $cloudContent = 'old list';

    private bool $fileExists = true;

    private bool $uploadFails = false;

    private TaskFileDomainService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->storedFile = new TaskFileEntity();
        $this->storedFile->setFileId(900);
        $this->storedFile->setProjectId(100);
        $this->storedFile->setParentId(500);
        $this->storedFile->setFileName('SKILLS.md');
        $this->storedFile->setFileKey('DT001/open/project_100/workspace/900');
        $this->storedFile->setFileSize(strlen($this->cloudContent));
        $this->storedFile->setMetadataVersion(6);
        $this->storedFile->setLatestVersion(3);

        $repository = $this->createMock(TaskFileRepositoryInterface::class);
        $repository->method('getByProjectIdAndFileKey')->willReturnCallback(
            fn (): ?TaskFileEntity => $this->fileExists ? clone $this->storedFile : null
        );
        $repository->method('getById')->willReturnCallback(fn (): TaskFileEntity => clone $this->storedFile);
        $repository->method('getFileTreeFileById')->willReturnCallback(fn (): TaskFileEntity => clone $this->storedFile);
        $repository->method('updateById')->willReturnCallback(function (TaskFileEntity $file, ?string $operation = null, bool $emitJournal = true): TaskFileEntity {
            $this->storedFile = clone $file;
            if ($emitJournal) {
                $this->snapshots[] = clone $file;
            }
            return $file;
        });
        $repository->method('bumpMetadataVersions')->willReturnCallback(function (array $ids): int {
            self::assertSame([900], $ids);
            $this->storedFile->setMetadataVersion($this->storedFile->getMetadataVersion() + 1);
            return 1;
        });
        $repository->method('appendFileTreeMutation')->willReturnCallback(function (?TaskFileEntity $before, ?TaskFileEntity $after): void {
            self::assertNotNull($before);
            self::assertNotNull($after);
            $this->snapshots[] = clone $after;
        });

        $cloud = $this->createMock(CloudFileRepositoryInterface::class);
        $cloud->method('createFileByCredential')->willReturnCallback(function (string $prefix, string $organizationCode, string $fileKey, string $content, StorageBucketType $bucket): void {
            self::assertSame('project_100/workspace/', $prefix);
            self::assertSame('DT001', $organizationCode);
            self::assertSame($this->storedFile->getFileKey(), $fileKey);
            self::assertSame(StorageBucketType::SandBox, $bucket);
            if ($this->uploadFails) {
                throw new RuntimeException('Object upload failed');
            }
            $this->cloudContent = $content;
        });
        $cloud->method('getHeadObjectByCredential')->willReturnCallback(
            fn (): array => ['content_length' => strlen($this->cloudContent)]
        );

        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);
        $magicFS = new MagicFSFileDomainService(
            $repository,
            $this->createMock(TaskRepositoryInterface::class),
            $cloud,
            $this->createMock(ProjectRepositoryInterface::class),
            $loggerFactory,
        );

        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn(new ArrayRowConnectionStub());
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn (string $id) => match ($id) {
            MagicFSFileDomainService::class => $magicFS,
            Db::class => new Db($container),
            ConnectionResolverInterface::class => $resolver,
            default => null,
        });
        ApplicationContext::setContainer($container);

        // Only initialize dependencies used by the two content-update methods.
        $reflection = new ReflectionClass(TaskFileDomainService::class);
        $this->service = $reflection->newInstanceWithoutConstructor();
        foreach (['taskFileRepository' => $repository, 'cloudFileRepository' => $cloud, 'logger' => $logger] as $property => $dependency) {
            $reflection->getProperty($property)->setValue($this->service, $dependency);
        }
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
        parent::tearDown();
    }

    #[DataProvider('replacementContents')]
    public function testOverwritePublishesFreshCacheVersion(string $content): void
    {
        $project = new ProjectEntity();
        $project->setId(100);
        $project->setWorkDir('/project_100/workspace');
        $project->setUserOrganizationCode('DT001');

        $updated = $this->service->overwriteProjectFileContent($project, $this->storedFile->getFileKey(), $content);

        self::assertSame($content, $this->cloudContent);
        $this->assertFreshSnapshot($updated, strlen($content));
    }

    #[DataProvider('replacementContents')]
    public function testRefreshAfterRollbackPublishesFreshCacheVersion(string $content): void
    {
        $this->cloudContent = $content;
        $updated = $this->service->refreshFileMetadataFromCloudStorage(clone $this->storedFile, 'DT001');

        $this->assertFreshSnapshot($updated, strlen($content));
    }

    public static function replacementContents(): array
    {
        return ['same size' => ['new list'], 'empty file' => ['']];
    }

    public function testMissingFileDoesNotChangeStorageOrJournal(): void
    {
        $this->fileExists = false;
        $project = new ProjectEntity();
        $project->setId(100);

        self::assertNull($this->service->overwriteProjectFileContent($project, $this->storedFile->getFileKey(), 'new list'));
        self::assertSame('old list', $this->cloudContent);
        self::assertSame(6, $this->storedFile->getMetadataVersion());
        self::assertSame([], $this->snapshots);
    }

    public function testFailedUploadDoesNotAdvanceCacheVersion(): void
    {
        $this->uploadFails = true;
        $project = new ProjectEntity();
        $project->setId(100);
        $project->setWorkDir('/project_100/workspace');
        $project->setUserOrganizationCode('DT001');

        try {
            $this->service->overwriteProjectFileContent($project, $this->storedFile->getFileKey(), 'new list');
            self::fail('Failed upload must propagate its exception.');
        } catch (RuntimeException $exception) {
            self::assertSame('Object upload failed', $exception->getMessage());
        }

        self::assertSame('old list', $this->cloudContent);
        self::assertSame(6, $this->storedFile->getMetadataVersion());
        self::assertSame([], $this->snapshots);
    }

    private function assertFreshSnapshot(?TaskFileEntity $updated, int $size): void
    {
        self::assertNotNull($updated);
        self::assertSame(7, $updated->getMetadataVersion(), 'Content replacement must invalidate a sandbox cache even when its size is unchanged.');
        self::assertSame($size, $updated->getFileSize());
        self::assertSame(3, $updated->getLatestVersion());
        self::assertCount(1, $this->snapshots);
        self::assertSame(7, $this->snapshots[0]->getMetadataVersion());
        self::assertSame($size, $this->snapshots[0]->getFileSize());
    }
}
