<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Event\Subscribe;

use App\Application\Design\Event\Subscribe\DesignVideoPollConsumer;
use App\Application\Design\Tool\VideoGeneration\DesignGeneratedVideoFileNameTool;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Design\Contract\VideoGatewayClientInterface;
use Closure;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Amqp\Producer;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class DesignVideoPollConsumerTest extends TestCase
{
    public function testArchiveFilesUsesStoredDirectoryIdWhenOriginalDirectoryPathChanged(): void
    {
        $repository = new InMemoryDesignGenerationTaskRepository();
        $consumer = $this->createConsumer(
            repository: $repository,
            taskFileDomainService: $this->createTaskFileDomainServiceForRenamedDirectory(),
            fileDomainService: $this->createFileDomainServiceExpectingUpload('/project_123/workspace/renamed/'),
        );
        $entity = $this->createEntity('/old-name', [
            'file_dir_id' => 7001,
        ]);
        $videoPath = $this->createTemporaryVideoFile();

        try {
            $consumer->archiveFilesForTest(
                DesignDataIsolation::create('org', 'user-1'),
                $entity,
                $this->createSucceededResult($videoPath),
            );
        } finally {
            @unlink($videoPath);
        }

        $this->assertSame(DesignGenerationStatus::COMPLETED, $entity->getStatus());
        $this->assertSame('/renamed/smart-video.mp4', $entity->getOutputPayload()['relative_file_path'] ?? null);
        $this->assertSame(7001, $entity->getOutputPayload()['file_dir_id'] ?? null);
        $this->assertSame('/renamed', $entity->getFileDir());
        $this->assertSame(1, $repository->updateCount);
    }

    public function testArchiveFilesCompletesWithoutDirectoryAndKeepsProviderOutputAndSmartFileName(): void
    {
        $repository = new InMemoryDesignGenerationTaskRepository();
        $consumer = $this->createConsumer(
            repository: $repository,
            taskFileDomainService: $this->createTaskFileDomainServiceWithoutDirectory(),
        );
        $entity = $this->createEntity('/missing-name', [
            'file_dir_id' => 8001,
        ]);

        $consumer->archiveFilesForTest(
            DesignDataIsolation::create('org', 'user-1'),
            $entity,
            $this->createSucceededResult('https://provider.example.com/result.mp4'),
        );

        $this->assertSame(DesignGenerationStatus::COMPLETED, $entity->getStatus());
        $this->assertSame('smart-video.mp4', $entity->getFileName());
        $this->assertSame('', $entity->getOutputPayload()['relative_file_path'] ?? null);
        $this->assertSame('https://provider.example.com/result.mp4', $entity->getOutputPayload()['provider_video_url'] ?? null);
        $this->assertSame('file_dir_missing', $entity->getOutputPayload()['archive_skipped_reason'] ?? null);
    }

    public function testArchiveFilesFallsBackToLegacyDirectoryPathWithoutStoredDirectoryId(): void
    {
        $repository = new InMemoryDesignGenerationTaskRepository();
        $consumer = $this->createConsumer(
            repository: $repository,
            taskFileDomainService: $this->createTaskFileDomainServiceForLegacyDirectory(),
            fileDomainService: $this->createFileDomainServiceExpectingUpload('/project_123/workspace/legacy/'),
        );
        $entity = $this->createEntity('/legacy');
        $videoPath = $this->createTemporaryVideoFile();

        try {
            $consumer->archiveFilesForTest(
                DesignDataIsolation::create('org', 'user-1'),
                $entity,
                $this->createSucceededResult($videoPath),
            );
        } finally {
            @unlink($videoPath);
        }

        $this->assertSame(DesignGenerationStatus::COMPLETED, $entity->getStatus());
        $this->assertSame('/legacy/smart-video.mp4', $entity->getOutputPayload()['relative_file_path'] ?? null);
        $this->assertSame(6001, $entity->getOutputPayload()['file_dir_id'] ?? null);
    }

    private function createConsumer(
        InMemoryDesignGenerationTaskRepository $repository,
        TaskFileDomainService $taskFileDomainService,
        ?FileDomainService $fileDomainService = null,
    ): TestableDesignVideoPollConsumer {
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $projectDomainService->method('getProjectNotUserId')->with(123)->willReturn(new ProjectEntity([
            'id' => 123,
            'user_organization_code' => 'org',
        ]));

        $fileNameTool = $this->createMock(DesignGeneratedVideoFileNameTool::class);
        $fileNameTool->method('resolveBaseNameWithoutExtension')->willReturn('smart-video');

        return new TestableDesignVideoPollConsumer(
            new DesignGenerationTaskDomainService($repository),
            $this->createMock(VideoGatewayClientInterface::class),
            $this->createMock(Producer::class),
            $fileDomainService ?? $this->createFileDomainServiceExpectingNoUpload(),
            $taskFileDomainService,
            $projectDomainService,
            $fileNameTool,
            $this->createMock(LoggerInterface::class),
        );
    }

    private function createTaskFileDomainServiceForRenamedDirectory(): TaskFileDomainService
    {
        $service = $this->createMock(TaskFileDomainService::class);
        $service->expects($this->once())->method('getById')->with(7001)->willReturn($this->createDirectory(7001, '/org/project_123/workspace/renamed'));
        $service->expects($this->never())->method('getByFileKey');
        $service->expects($this->once())->method('saveProjectFile')->willReturnCallback(
            fn (mixed $dataIsolation, ProjectEntity $projectEntity, TaskFileEntity $taskFileEntity): TaskFileEntity => $this->createSavedFile(9001, $taskFileEntity->getFileKey())
        );

        return $service;
    }

    private function createTaskFileDomainServiceWithoutDirectory(): TaskFileDomainService
    {
        $service = $this->createMock(TaskFileDomainService::class);
        $service->expects($this->once())->method('getById')->with(8001)->willReturn(null);
        $service->expects($this->once())->method('getByFileKey')->with('/org/project_123/workspace/missing-name/')->willReturn(null);
        $service->expects($this->never())->method('saveProjectFile');

        return $service;
    }

    private function createTaskFileDomainServiceForLegacyDirectory(): TaskFileDomainService
    {
        $service = $this->createMock(TaskFileDomainService::class);
        $service->expects($this->never())->method('getById');
        $service->expects($this->once())->method('getByFileKey')->with('/org/project_123/workspace/legacy/')->willReturn($this->createDirectory(6001, '/org/project_123/workspace/legacy'));
        $service->expects($this->once())->method('saveProjectFile')->willReturnCallback(
            fn (mixed $dataIsolation, ProjectEntity $projectEntity, TaskFileEntity $taskFileEntity): TaskFileEntity => $this->createSavedFile(9002, $taskFileEntity->getFileKey())
        );

        return $service;
    }

    private function createFileDomainServiceExpectingUpload(string $expectedUploadDir): FileDomainService
    {
        return new RecordingFileDomainService('/org', function (string $organizationCode, UploadFile $uploadFile) use ($expectedUploadDir): void {
            $this->assertSame('org', $organizationCode);
            $this->assertSame($expectedUploadDir, $uploadFile->getDir());
            $this->assertSame('smart-video.mp4', $uploadFile->getName());
        });
    }

    private function createFileDomainServiceExpectingNoUpload(): FileDomainService
    {
        return new RecordingFileDomainService('/org', function (): void {
            $this->fail('Video file should not be uploaded when output directory is missing.');
        });
    }

    private function createEntity(string $fileDir, array $outputPayload = []): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setId(1001);
        $entity->setOrganizationCode('org');
        $entity->setUserId('user-1');
        $entity->setProjectId(123);
        $entity->setGenerationId('video-1');
        $entity->setAssetType(DesignGenerationAssetType::VIDEO);
        $entity->setGenerationType(DesignGenerationType::TEXT_TO_VIDEO);
        $entity->setModelId('model-1');
        $entity->setPrompt('这是一段用于生成视频的提示词');
        $entity->setFileDir($fileDir);
        $entity->setFileName('');
        $entity->setInputPayload([]);
        $entity->setRequestPayload([]);
        $entity->setProviderPayload([]);
        $entity->setOutputPayload(array_merge([
            'relative_file_path' => '',
            'relative_poster_path' => '',
            'poster_file_name' => '',
            'provider_video_url' => '',
            'provider_poster_url' => '',
            'duration_seconds' => null,
            'resolution' => '',
            'fps' => null,
            'last_operation_output' => [],
            'last_output_updated_at' => null,
        ], $outputPayload));
        $entity->setStatus(DesignGenerationStatus::PROCESSING);
        $entity->setErrorMessage(null);
        $entity->setCreatedAt(new DateTime());
        $entity->setUpdatedAt(new DateTime());

        return $entity;
    }

    private function createDirectory(int $fileId, string $fileKey): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setProjectId(123);
        $entity->setFileKey($fileKey);
        $entity->setFileName(basename($fileKey));
        $entity->setIsDirectory(true);
        $entity->setSource(TaskFileSource::DEFAULT);
        $entity->setCreatedAt('2026-04-22 00:00:00');
        $entity->setUpdatedAt('2026-04-22 00:00:00');

        return $entity;
    }

    private function createSavedFile(int $fileId, string $fileKey): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($fileId);
        $entity->setProjectId(123);
        $entity->setFileKey($fileKey);
        $entity->setFileName(basename($fileKey));
        $entity->setIsDirectory(false);
        $entity->setSource(TaskFileSource::AI_VIDEO_GENERATION);
        $entity->setCreatedAt('2026-04-22 00:00:00');
        $entity->setUpdatedAt('2026-04-22 00:00:00');

        return $entity;
    }

    private function createSucceededResult(string $videoUrl): array
    {
        return [
            'output' => [
                'video_url' => $videoUrl,
                'duration_seconds' => 5,
                'resolution' => '720p',
                'fps' => 24,
            ],
        ];
    }

    private function createTemporaryVideoFile(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'design-video-test-');
        $videoPath = $path . '.mp4';
        rename($path, $videoPath);
        file_put_contents($videoPath, 'video-bytes');

        return $videoPath;
    }
}

class TestableDesignVideoPollConsumer extends DesignVideoPollConsumer
{
    public function archiveFilesForTest(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, array $result): void
    {
        $this->archiveFiles($dataIsolation, $entity, $result);
    }
}

class InMemoryDesignGenerationTaskRepository implements DesignGenerationTaskRepositoryInterface
{
    public int $updateCount = 0;

    public function create(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
    }

    public function update(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        ++$this->updateCount;
    }

    public function delete(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
    }

    public function findByProjectAndGenerationId(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $generationId
    ): ?DesignGenerationTaskEntity {
        return null;
    }

    public function findProcessingTasksAfterId(int $cursorId, int $limit): array
    {
        return [];
    }
}

readonly class RecordingFileDomainService extends FileDomainService
{
    public function __construct(
        private string $fullPrefix,
        private Closure $onUpload,
    ) {
    }

    public function getFullPrefix(string $organizationCode): string
    {
        return $this->fullPrefix;
    }

    public function uploadByCredential(
        string $organizationCode,
        UploadFile $uploadFile,
        StorageBucketType $storage = StorageBucketType::Private,
        bool $autoDir = true,
        ?string $contentType = null
    ): void {
        ($this->onUpload)($organizationCode, $uploadFile, $storage, $autoDir, $contentType);
    }
}
