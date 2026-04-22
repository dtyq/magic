<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Application\Design\Service\DesignVideoAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogModelDefinition;
use App\Domain\VideoCatalog\Service\VideoCatalogQueryDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Amqp\Producer;
use PHPUnit\Framework\TestCase;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * @internal
 */
class DesignVideoAppServiceTest extends TestCase
{
    public function testCreateStoresOutputDirectoryFileIdSnapshot(): void
    {
        $repository = new InMemoryDesignVideoTaskRepository();
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('getByFileKey')
            ->with('/org/project_123/workspace/out/')
            ->willReturn($this->createDirectory(7001, '/org/project_123/workspace/out'));

        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->isInstanceOf(DesignVideoPollDelayPublisher::class));

        $service = new TestableDesignVideoAppService(
            $taskFileDomainService,
            new CreateVideoFileDomainService('/org'),
            new StubVideoCatalogQueryDomainService($this->createModelDefinition()),
            new DesignGenerationTaskDomainService($repository),
            new StubDesignVideoSubmissionDomainService(),
            $producer,
        );
        $entity = DesignGenerationTaskFactory::createVideoTask(new DesignVideoCreateDTO([
            'project_id' => 123,
            'video_id' => 'video-1',
            'model_id' => 'video-model',
            'prompt' => '生成一个用于测试的视频',
            'file_dir' => '/out',
            'task' => 'generate',
        ]));

        $result = $service->create($this->createMock(Authenticatable::class), $entity);

        $this->assertSame(7001, $result->getOutputDirectoryFileId());
        $this->assertSame(7001, $repository->createdEntity?->getOutputDirectoryFileId());
    }

    private function createModelDefinition(): VideoCatalogModelDefinition
    {
        return new VideoCatalogModelDefinition(
            id: 1,
            serviceProviderConfigId: 'provider-config-1',
            modelId: 'video-model',
            name: 'Video Model',
            modelVersion: 'video-model-version',
            description: '',
            icon: '',
            modelType: 0,
            category: 'vgm',
            status: 1,
            providerCode: 'Cloudsway',
        );
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
}

class TestableDesignVideoAppService extends DesignVideoAppService
{
    protected function createDesignDataIsolation(Authenticatable|BaseDataIsolation $authorization): DesignDataIsolation
    {
        return DesignDataIsolation::create('org', 'user-1');
    }

    protected function assertProjectAccess(DesignDataIsolation $dataIsolation, int $projectId, MemberRole $role): ProjectEntity
    {
        return new ProjectEntity([
            'id' => $projectId,
            'user_id' => 'user-1',
            'user_organization_code' => 'org',
            'created_uid' => 'user-1',
        ]);
    }
}

readonly class CreateVideoFileDomainService extends FileDomainService
{
    public function __construct(private string $fullPrefix)
    {
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
    }
}

readonly class StubVideoCatalogQueryDomainService extends VideoCatalogQueryDomainService
{
    public function __construct(private VideoCatalogModelDefinition $modelDefinition)
    {
    }

    public function findModel(string $modelIdOrPrimaryId): ?VideoCatalogModelDefinition
    {
        return $this->modelDefinition;
    }
}

readonly class StubDesignVideoSubmissionDomainService extends DesignVideoSubmissionDomainService
{
    public function __construct()
    {
    }

    public function submit(DesignGenerationTaskEntity $entity): array
    {
        return [
            'provider' => 'Cloudsway',
            'submit_endpoint' => '/v1/videos',
            'operation_id' => 'operation-1',
            'submitted_at' => date(DATE_ATOM),
            'poll_attempts' => 0,
            'deadline_at' => date(DATE_ATOM, time() + 3600),
        ];
    }
}

class InMemoryDesignVideoTaskRepository implements DesignGenerationTaskRepositoryInterface
{
    public ?DesignGenerationTaskEntity $createdEntity = null;

    public function create(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $entity->setId(1001);
        $this->createdEntity = $entity;
    }

    public function update(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
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
