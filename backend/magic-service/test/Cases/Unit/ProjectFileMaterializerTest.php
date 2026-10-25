<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Support\ProjectFileMaterializer;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use Dtyq\CloudFile\Kernel\Struct\DownloadedRemoteFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use PHPUnit\Framework\TestCase;

/** @internal */
final class ProjectFileMaterializerTest extends TestCase
{
    public function testReturnsExistingFileKeyWithoutUploadingDuplicateContent(): void
    {
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectsWithAuth')->willReturn([$this->createMock(ProjectEntity::class)]);

        $file = $this->createMock(TaskFileEntity::class);
        $file->method('getFileKey')->willReturn('sandbox/source.png');
        $file->method('getFileName')->willReturn('source.png');
        $taskFiles = $this->createMock(TaskFileDomainService::class);
        $taskFiles->method('findEntityByRelativePath')->willReturn($file);

        $cloudFiles = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFiles->method('getLinks')->willReturn([
            'sandbox/source.png' => new FileLink('sandbox/source.png', 'https://example.com/source.png', 0),
        ]);
        $cloudFiles->expects(self::never())->method('uploadByCredential');

        $temporaryFile = tempnam(sys_get_temp_dir(), 'project-dedup-');
        file_put_contents($temporaryFile, 'same-content');
        $downloader = $this->createMock(SafeRemoteFileDownloader::class);
        $downloader->method('download')->willReturn(
            new DownloadedRemoteFile($temporaryFile, 'source.png', 'image/png', 12),
        );

        $assets = $this->createMock(AssetDomainService::class);
        $assets->expects(self::once())->method('findPersonalAssetByContentHash')
            ->with('user-1', hash('sha256', 'same-content'), true)
            ->willReturn(new AssetEntity([
                'organization_code' => 'org-1',
                'file_key' => 'org-1/private/existing.png',
            ]));

        $materializer = new ProjectFileMaterializer(
            $projects,
            $taskFiles,
            new FileDomainService($cloudFiles),
            $assets,
            $downloader,
        );

        self::assertSame(
            'org-1/private/existing.png',
            $materializer->materialize(new AssetDataIsolation('org-1', 'user-1'), 123, '/source.png')['file_key'],
        );
        self::assertFileDoesNotExist($temporaryFile);
    }

    public function testImportsAccessibleProjectFileToPrivateBucket(): void
    {
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->expects(self::once())->method('getProjectsWithAuth')
            ->with([123], 'user-1', 'org-1')
            ->willReturn([$this->createMock(ProjectEntity::class)]);

        $file = $this->createMock(TaskFileEntity::class);
        $file->method('getFileKey')->willReturn('sandbox/project/source.png');
        $file->method('getFileName')->willReturn('source.png');
        $taskFiles = $this->createMock(TaskFileDomainService::class);
        $taskFiles->expects(self::once())->method('findEntityByRelativePath')
            ->with(123, '/images/source.png')
            ->willReturn($file);

        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $repository->method('getLinks')->willReturn([
            'sandbox/project/source.png' => new FileLink('sandbox/project/source.png', 'https://example.com/source.png', 0),
        ]);
        $repository->expects(self::once())->method('uploadByCredential')
            ->willReturnCallback(static function (string $organizationCode, UploadFile $upload): void {
                self::assertSame('org-1', $organizationCode);
                self::assertStringEndsWith('.png', $upload->getName());
                $upload->setKey('org-1/private/source.png');
            });

        $temporaryFile = tempnam(sys_get_temp_dir(), 'project-import-');
        file_put_contents($temporaryFile, 'image');
        $downloader = $this->createMock(SafeRemoteFileDownloader::class);
        $downloader->expects(self::once())->method('download')
            ->with('https://example.com/source.png')
            ->willReturn(new DownloadedRemoteFile($temporaryFile, 'source.png', 'image/png', 5));

        $assets = $this->createMock(AssetDomainService::class);
        $assets->method('findPersonalAssetByContentHash')->willReturn(null);
        $materializer = new ProjectFileMaterializer($projects, $taskFiles, new FileDomainService($repository), $assets, $downloader);
        $isolation = new AssetDataIsolation('org-1', 'user-1');

        self::assertSame('org-1/private/source.png', $materializer->materialize($isolation, 123, '/images/source.png')['file_key']);
        self::assertFileDoesNotExist($temporaryFile);
    }

    public function testRejectsInaccessibleProjectBeforeReadingFile(): void
    {
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectsWithAuth')->willReturn([]);
        $taskFiles = $this->createMock(TaskFileDomainService::class);
        $taskFiles->expects(self::never())->method('findEntityByRelativePath');

        $materializer = new ProjectFileMaterializer(
            $projects,
            $taskFiles,
            new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)),
            $this->createMock(AssetDomainService::class),
            $this->createMock(SafeRemoteFileDownloader::class),
        );

        self::assertNull($materializer->materialize(new AssetDataIsolation('org-1', 'user-1'), 123, '/secret.png'));
    }
}
