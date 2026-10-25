<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Application\Design\Event\Publish\DesignVideoSubmitPublisher;
use App\Application\Design\Service\DesignVideoAppService;
use App\Application\Design\Support\DesignDraftTaskResolver;
use App\Application\ModelGateway\Mapper\ModelAttributes;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;
use DateTime;
use Hyperf\Amqp\Producer;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use ReflectionClass;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class DesignVideoAppServiceTest extends TestCase
{
    private mixed $previousContainer = null;

    private bool $hadContainer = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->hadContainer = ApplicationContext::hasContainer();
        $this->previousContainer = $this->hadContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }
                if ($id === ConfigInterface::class) {
                    return new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        DesignErrorCode::class => [14000, 14999],
                                    ],
                                ],
                                default => $default,
                            };
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    };
                }
                if ($id === TranslatorInterface::class) {
                    return new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): array|string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'en';
                        }

                        public function setLocale(string $locale)
                        {
                        }
                    };
                }
                throw new RuntimeException('Unsupported service: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class || $id === ConfigInterface::class || $id === TranslatorInterface::class;
            }
        });
    }

    protected function tearDown(): void
    {
        if ($this->hadContainer && $this->previousContainer instanceof ContainerInterface) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            $property = new ReflectionProperty(ApplicationContext::class, 'container');
            $property->setAccessible(true);
            $property->setValue(null, null);
        }

        $this->previousContainer = null;
        $this->hadContainer = false;

        parent::tearDown();
    }

    public function testCanvasCompositionValidatesFilesInBatchesAndDispatchesAsyncSubmission(): void
    {
        $repository = new InMemoryDesignVideoTaskRepository();
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $videoDirectory = $this->createDirectory(7001, '/org/project_123/workspace/canvas/videos');
        $audioDirectory = $this->createDirectory(7002, '/org/project_123/workspace/canvas/audios');
        $taskFileDomainService->expects($this->exactly(2))
            ->method('findEntityByRelativePath')
            ->willReturnMap([
                [123, '/canvas/videos', $videoDirectory],
                [123, '/canvas/audios', $audioDirectory],
            ]);
        $taskFileDomainService->expects($this->exactly(2))
            ->method('getByProjectParentAndNames')
            ->willReturnMap([
                [123, 7001, ['a.mp4', 'b.mp4'], [
                    'a.mp4' => $this->createFile(7101, '/org/project_123/workspace/canvas/videos/a.mp4'),
                    'b.mp4' => $this->createFile(7102, '/org/project_123/workspace/canvas/videos/b.mp4'),
                ]],
                [123, 7002, ['bgm.mp3'], [
                    'bgm.mp3' => $this->createFile(7201, '/org/project_123/workspace/canvas/audios/bgm.mp3'),
                ]],
            ]);

        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->isInstanceOf(DesignVideoSubmitPublisher::class));
        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->never())->method('getOrganizationVideoModel');

        $service = new TestableDesignVideoAppService(
            $taskFileDomainService,
            $modelGatewayMapper,
            new DesignGenerationTaskDomainService($repository),
            new UnexpectedDesignVideoSubmissionDomainService(),
            $this->createDraftTaskResolver(),
            $producer,
        );
        $entity = $this->createCanvasCompositionEntity();

        $result = $service->create($this->createMock(Authenticatable::class), $entity);

        $this->assertSame(DesignGenerationStatus::PENDING, $result->getStatus());
        $this->assertSame('', $result->getOperationId());
        $this->assertSame(7001, $result->getOutputDirectoryFileId());
    }

    public function testCanvasCompositionRejectsMissingInputFileBeforeCreatingTask(): void
    {
        $repository = new InMemoryDesignVideoTaskRepository();
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('findEntityByRelativePath')
            ->with(123, '/canvas/videos')
            ->willReturn($this->createDirectory(7001, '/org/project_123/workspace/canvas/videos'));
        $taskFileDomainService->expects($this->once())
            ->method('getByProjectParentAndNames')
            ->with(123, 7001, ['a.mp4', 'b.mp4'])
            ->willReturn([
                'a.mp4' => $this->createFile(7101, '/org/project_123/workspace/canvas/videos/a.mp4'),
            ]);
        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->never())->method('getOrganizationVideoModel');

        $service = new TestableDesignVideoAppService(
            $taskFileDomainService,
            $modelGatewayMapper,
            new DesignGenerationTaskDomainService($repository),
            new UnexpectedDesignVideoSubmissionDomainService(),
            $this->createDraftTaskResolver(),
            $this->createMock(Producer::class),
        );

        $this->expectException(BusinessException::class);

        try {
            $service->create(
                $this->createMock(Authenticatable::class),
                $this->createCanvasCompositionEntity(withAudio: false),
            );
        } finally {
            $this->assertNull($repository->createdEntity);
        }
    }

    public function testCreateStoresOutputDirectoryFileIdSnapshot(): void
    {
        $repository = new InMemoryDesignVideoTaskRepository();
        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('findEntityByRelativePath')
            ->with(123, '/out')
            ->willReturn($this->createDirectory(7001, '/org/project_123/workspace/out'));
        $taskFileDomainService->expects($this->never())->method('getByFileKey');

        $producer = $this->createMock(Producer::class);
        $producer->expects($this->once())
            ->method('produce')
            ->with($this->isInstanceOf(DesignVideoPollDelayPublisher::class));
        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($this->anything(), 'video-model')
            ->willReturn($this->createModelEntry());

        $service = new TestableDesignVideoAppService(
            $taskFileDomainService,
            $modelGatewayMapper,
            new DesignGenerationTaskDomainService($repository),
            new StubDesignVideoSubmissionDomainService(),
            $this->createDraftTaskResolver(),
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

    public function testQueryHydratesCompletedFileByNameBasedRelativePath(): void
    {
        $repository = new InMemoryDesignVideoTaskRepository();
        $repository->foundEntity = $this->createCompletedEntity('/433333/videos/smart-video.mp4');

        $taskFileDomainService = $this->createMock(TaskFileDomainService::class);
        $taskFileDomainService->expects($this->once())
            ->method('findEntityByRelativePath')
            ->with(123, '/433333/videos/smart-video.mp4')
            ->willReturn($this->createFile(9003, '/org/project_123/workspace/7001/smart-video.mp4'));
        $taskFileDomainService->expects($this->never())->method('getByFileKey');
        $taskFileDomainService->expects($this->once())
            ->method('getFileUrls')
            ->with(
                projectOrganizationCode: 'org',
                projectId: 123,
                fileIds: [9003],
                downloadMode: 'preview'
            )
            ->willReturn([[
                'url' => 'https://cdn.example.com/smart-video.mp4',
            ]]);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->never())->method('getOrganizationVideoModel');

        $service = new TestableDesignVideoAppService(
            $taskFileDomainService,
            $modelGatewayMapper,
            new DesignGenerationTaskDomainService($repository),
            new StubDesignVideoSubmissionDomainService(),
            $this->createDraftTaskResolver(),
            $this->createMock(Producer::class),
        );

        $result = $service->query($this->createMock(Authenticatable::class), 123, 'video-1');

        $this->assertSame(DesignGenerationStatus::COMPLETED, $result->getStatus());
        $this->assertSame('9003', $result->getFileId());
        $this->assertSame('https://cdn.example.com/smart-video.mp4', $result->getFileUrl());
    }

    /**
     * 本文件用例都不涉及样片成片，且 draft_task 为空时 resolve() 会提前返回，
     * 因此跳过构造即可，不必为其准备仓储。
     */
    private function createDraftTaskResolver(): DesignDraftTaskResolver
    {
        return (new ReflectionClass(DesignDraftTaskResolver::class))->newInstanceWithoutConstructor();
    }

    private function createModelEntry(): ModelEntry
    {
        return new ModelEntry(
            new ModelAttributes(
                key: 'video-model',
                name: 'Video Model',
                label: 'Video Model',
                icon: '',
                tags: [],
                createdAt: new DateTime(),
                owner: 'MagicAI',
                modelVersion: 'video-model-version',
                providerCode: 'Cloudsway',
            ),
            new VideoModel([], 'video-model-version', 'provider-model', ProviderCode::Cloudsway),
        );
    }

    /** 创建仅包含模拟工作区文件的画布合成任务。 */
    private function createCanvasCompositionEntity(bool $withAudio = true): DesignGenerationTaskEntity
    {
        $composition = [
            'videos' => [
                ['path' => '/canvas/videos/a.mp4'],
                ['path' => '/canvas/videos/b.mp4'],
            ],
        ];
        if ($withAudio) {
            $composition['audios'] = [['path' => '/canvas/audios/bgm.mp3']];
        }

        return DesignGenerationTaskFactory::createVideoTask(new DesignVideoCreateDTO([
            'project_id' => 123,
            'video_id' => 'composition-1',
            'generation_type' => DesignGenerationType::CANVAS_COMPOSITION->value,
            'file_dir' => '/canvas/videos',
            'composition' => $composition,
            'extensions' => [
                'output_file_name' => 'final.mp4',
            ],
        ]));
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

    private function createFile(int $fileId, string $fileKey): TaskFileEntity
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

    private function createCompletedEntity(string $relativeFilePath): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setId(1001);
        $entity->setOrganizationCode('org');
        $entity->setUserId('user-1');
        $entity->setProjectId(123);
        $entity->setGenerationId('video-1');
        $entity->setAssetType(DesignGenerationAssetType::VIDEO);
        $entity->setGenerationType(DesignGenerationType::TEXT_TO_VIDEO);
        $entity->setModelId('video-model');
        $entity->setPrompt('生成一个用于测试的视频');
        $entity->setFileDir('/433333/videos');
        $entity->setFileName('smart-video.mp4');
        $entity->setInputPayload([]);
        $entity->setRequestPayload([]);
        $entity->setProviderPayload([]);
        $entity->setOutputPayload([
            'relative_file_path' => $relativeFilePath,
            'relative_poster_path' => '',
        ]);
        $entity->setStatus(DesignGenerationStatus::COMPLETED);
        $entity->setErrorMessage(null);
        $entity->setCreatedAt(new DateTime());
        $entity->setUpdatedAt(new DateTime());

        return $entity;
    }
}

class TestableDesignVideoAppService extends DesignVideoAppService
{
    protected function createDesignDataIsolation(Authenticatable|BaseDataIsolation $authorization): DesignDataIsolation
    {
        return new class extends DesignDataIsolation {
            public function __construct()
            {
            }

            public function getCurrentOrganizationCode(): string
            {
                return 'org';
            }

            public function getCurrentUserId(): string
            {
                return 'user-1';
            }
        };
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

readonly class UnexpectedDesignVideoSubmissionDomainService extends DesignVideoSubmissionDomainService
{
    public function __construct()
    {
    }

    public function submit(DesignGenerationTaskEntity $entity): array
    {
        throw new RuntimeException('画布合成不应在 HTTP 请求中同步提交');
    }
}

class InMemoryDesignVideoTaskRepository implements DesignGenerationTaskRepositoryInterface
{
    public ?DesignGenerationTaskEntity $createdEntity = null;

    public ?DesignGenerationTaskEntity $foundEntity = null;

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
        return $this->foundEntity;
    }

    public function findByProjectAndOutputFilePath(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $relativeFilePath
    ): ?DesignGenerationTaskEntity {
        return null;
    }

    public function findProcessingTasksAfterId(int $cursorId, int $limit): array
    {
        return [];
    }
}
