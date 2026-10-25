<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileVersionRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileVersionDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * 覆盖版本文件键生成：统一为原 file_key + /version/{version} 的追加格式，
 * 与空间类型（project/topic）无关。
 *
 * @internal
 */
class TaskFileVersionDomainServiceTest extends TestCase
{
    public function testTopicFileVersionKeyAppendsVersionSuffix(): void
    {
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->expects($this->once())
            ->method('copyObjectByCredential')
            ->with(
                '/',
                'DT001',
                'DT001/open/project_100/runtime/topic_456/789',
                'DT001/open/project_100/runtime/topic_456/789/version/1',
                StorageBucketType::SandBox,
                ['metadata_directive' => 'COPY']
            );

        $versionEntity = $this->service($cloudFileRepository)
            ->createFileVersion('DT001', $this->fileEntity('DT001/open/project_100/runtime/topic_456/789'));

        $this->assertNotNull($versionEntity);
        $this->assertSame('DT001/open/project_100/runtime/topic_456/789/version/1', $versionEntity->getFileKey());
        $this->assertSame(1, $versionEntity->getVersion());
    }

    public function testUserFileVersionKeyAppendsVersionSuffix(): void
    {
        // 用户空间文件（如 .magic/ 下的记忆文件）同样创建版本副本：
        // 版本键统一为原 file_key + /version/{version}。
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->expects($this->once())
            ->method('copyObjectByCredential')
            ->with(
                '/',
                'DT001',
                'DT001/open/user_usi_123/workspace/789',
                'DT001/open/user_usi_123/workspace/789/version/1',
                StorageBucketType::SandBox,
                ['metadata_directive' => 'COPY']
            );

        $fileEntity = new TaskFileEntity();
        $fileEntity->setFileId(789);
        $fileEntity->setFileName('MEMORY.md');
        $fileEntity->setOrganizationCode('DT001');
        $fileEntity->setFileKey('DT001/open/user_usi_123/workspace/789');
        $fileEntity->setIsDirectory(false);
        $fileEntity->setSpaceType(FileSpaceType::USER->value);

        $this->assertTrue($fileEntity->shouldCreateVersionCopy());

        $versionEntity = $this->service($cloudFileRepository)
            ->createFileVersion('DT001', $fileEntity);

        $this->assertNotNull($versionEntity);
        $this->assertSame('DT001/open/user_usi_123/workspace/789/version/1', $versionEntity->getFileKey());
        $this->assertSame(1, $versionEntity->getVersion());
    }

    public function testProjectFileVersionKeyAppendsVersionSuffix(): void
    {
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->expects($this->once())
            ->method('copyObjectByCredential')
            ->with(
                '/',
                'DT001',
                'DT001/open/project_100/workspace/789',
                'DT001/open/project_100/workspace/789/version/1',
                StorageBucketType::SandBox,
                ['metadata_directive' => 'COPY']
            );

        $versionEntity = $this->service($cloudFileRepository)
            ->createFileVersion('DT001', $this->fileEntity('DT001/open/project_100/workspace/789'));

        $this->assertNotNull($versionEntity);
        $this->assertSame('DT001/open/project_100/workspace/789/version/1', $versionEntity->getFileKey());
    }

    private function fileEntity(string $fileKey): TaskFileEntity
    {
        $fileEntity = $this->createMock(TaskFileEntity::class);
        $fileEntity->method('getIsDirectory')->willReturn(false);
        $fileEntity->method('getFileId')->willReturn(789);
        $fileEntity->method('getFileName')->willReturn('hello.txt');
        $fileEntity->method('getOrganizationCode')->willReturn('DT001');
        $fileEntity->method('getFileKey')->willReturn($fileKey);

        return $fileEntity;
    }

    private function service(CloudFileRepositoryInterface $cloudFileRepository): TaskFileVersionDomainService
    {
        $versionRepository = $this->createMock(TaskFileVersionRepositoryInterface::class);
        $versionRepository->method('getLatestVersionNumber')->willReturn(0);
        $versionRepository->method('countByFileId')->willReturn(0);
        $versionRepository->method('insert')->willReturnArgument(0);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        return new TaskFileVersionDomainService(
            $versionRepository,
            $taskFileRepository,
            $cloudFileRepository,
            $loggerFactory
        );
    }
}
