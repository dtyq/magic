<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelAttributes;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Repository\QueueExecutorConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use App\Domain\ModelGateway\Service\QueueOperationExecutionDomainService;
use App\Domain\ModelGateway\Service\VideoBillingDetailsResolver;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoProviderOperationExecutor;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\AbstractLogger;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Throwable;

/**
 * @internal
 */
class VideoOperationAppServiceTest extends TestCase
{
    private RecordingEventDispatcher $eventDispatcher;

    private ContainerInterface $originalContainer;

    protected function setUp(): void
    {
        parent::setUp();

        MockHttpsStreamWrapper::register();
        MockHttpsStreamWrapper::reset();
        $this->originalContainer = ApplicationContext::getContainer();
        $this->eventDispatcher = new RecordingEventDispatcher();
        ApplicationContext::setContainer(new EventDispatcherContainer($this->eventDispatcher, $this->originalContainer));
    }

    protected function tearDown(): void
    {
        ApplicationContext::setContainer($this->originalContainer);
        MockHttpsStreamWrapper::restore();

        parent::tearDown();
    }

    public function testEnqueueSubmitsImmediatelyAndPersistsProviderRunningState(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(submitResult: 'provider-task-1'),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-1', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'veo-3.1-fast-generate-preview')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'LCnVzCkkMnVulyrz', 'provider-model', ProviderCode::Cloudsway)));
        $videoGenerationConfigDomainService = $this->createVideoGenerationConfigDomainService();

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $pointComponent,
            $modelGatewayMapper,
            $videoGenerationConfigDomainService,
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );
        $logger = new RecordingLogger();
        $service->logger = $logger;

        $response = $service->enqueue('token-1', $requestDTO);

        $this->assertSame('running', $response->getStatus());
        $this->assertNull($response->getQueue()?->getPosition());
        $this->assertSame(0, $response->getQueue()?->getRunningCount());
        $this->assertArrayNotHasKey('provider', $response->toArray());
        $this->assertSame('provider-task-1', $operationRepository->operations[$response->getId()]->getProviderTaskId());
        $this->assertSame(VideoOperationStatus::PROVIDER_RUNNING, $operationRepository->operations[$response->getId()]->getStatus());
        $this->assertTrue($logger->hasRecord('info', 'video operation submitted'));
    }

    public function testGetOperationRejectsProviderTaskIdFallbackWhenInternalOperationIsMissing(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-unused',
                queryResult: [
                    'status' => 'running',
                    'output' => [],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-query-missing', [
                'provider_task_id' => 'provider-task-123',
                'model_id' => 'doubao-seedance-2-0-260128',
                'video_id' => 'video-1',
            ])
            ->willReturn($dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->method('getOrganizationVideoModel')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'VolcengineArk', 'provider-model-ark', ProviderCode::VolcengineArk)));

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('video task not found');

        $service->getOperation('token-query-missing', 'missing-operation-id', [
            'provider_task_id' => 'provider-task-123',
            'model_id' => 'doubao-seedance-2-0-260128',
            'video_id' => 'video-1',
        ]);
    }

    public function testEnqueueAndGetOperationDispatchesCloudswayVeoGeneratedEventWithDefaultBillingDetails(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-veo-default',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/veo-default.mp4',
                    ],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->exactly(2))
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-veo-default', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'veo-3.1-fast-generate-preview')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'LCnVzCkkMnVulyrz', 'provider-model-veo', ProviderCode::Cloudsway)));

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $pointComponent,
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $enqueueResponse = $service->enqueue('token-veo-default', $requestDTO);
        $storedOperation = $operationRepository->operations[$enqueueResponse->getId()];
        $this->assertSame(8, $storedOperation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $storedOperation->getRawRequest()['generation']['resolution']);

        $service->getOperation('token-veo-default', $enqueueResponse->getId());

        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(8, $event->getDurationSeconds());
        $this->assertSame('720p', $event->getResolution());
        $this->assertSame('1280x720', $event->getSize());
    }

    public function testEnqueueAndGetOperationDispatchesCloudswaySeedanceGeneratedEventWithDefaultBillingDetails(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'seedance-1.5-pro',
            'task' => 'generate',
            'prompt' => 'make a video',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-seedance-default',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/seedance-default.mp4',
                    ],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->exactly(2))
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-seedance-default', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'seedance-1.5-pro')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'rrpvTsUlqilBwMXg', 'provider-model-seedance', ProviderCode::Cloudsway)));

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $pointComponent,
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $enqueueResponse = $service->enqueue('token-seedance-default', $requestDTO);
        $storedOperation = $operationRepository->operations[$enqueueResponse->getId()];
        $this->assertSame(5, $storedOperation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $storedOperation->getRawRequest()['generation']['resolution']);

        $service->getOperation('token-seedance-default', $enqueueResponse->getId());

        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(5, $event->getDurationSeconds());
        $this->assertSame('720p', $event->getResolution());
        $this->assertSame('1280x720', $event->getSize());
    }

    public function testEnqueueAndGetOperationDispatchesCloudswayKelingGeneratedEventWithDefaultBillingDetails(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make a video',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-keling-default',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/keling-default.mp4',
                    ],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->exactly(2))
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-keling-default', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'keling-3.0-video')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'YGNqszpCuuWLpyUt', 'provider-model-keling', ProviderCode::Cloudsway)));

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $pointComponent,
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $enqueueResponse = $service->enqueue('token-keling-default', $requestDTO);
        $storedOperation = $operationRepository->operations[$enqueueResponse->getId()];
        $this->assertSame(5, $storedOperation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $storedOperation->getRawRequest()['generation']['resolution']);

        $service->getOperation('token-keling-default', $enqueueResponse->getId());

        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(5, $event->getDurationSeconds());
        $this->assertSame('720p', $event->getResolution());
        $this->assertSame('1280x720', $event->getSize());
    }

    public function testEnqueueAndGetOperationDispatchesVolcengineArkSeedanceGeneratedEventWithDefaults(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'doubao-seedance-2-0-260128',
            'task' => 'generate',
            'prompt' => 'make a cinematic drone shot',
            'generation' => [
                'generate_audio' => true,
            ],
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'model' => 'doubao-seedance-2-0-260128',
                        'task' => 'generate',
                        'content' => [
                            ['type' => 'text', 'text' => 'make a cinematic drone shot'],
                        ],
                        'resolution' => '720p',
                        'duration' => 5,
                        'generate_audio' => true,
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'id' => 'provider-task-ark-1',
            ], JSON_THROW_ON_ERROR)));
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/provider-task-ark-1',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'status' => 'succeeded',
                'content' => [
                    'video_url' => 'https://example.com/ark-seedance.mp4',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->exactly(2))
            ->method('create')
            ->willReturn($httpClient);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20)),
            new VideoProviderOperationExecutor(
                new VideoGenerateFactory(
                    new CloudswayVideoAdapterRouter(
                        new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                        new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                        new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    ),
                    new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory)),
                ),
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->exactly(2))
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-ark', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'doubao-seedance-2-0-260128')
            ->willReturn($this->createVideoModelEntry(
                new VideoModel([], 'doubao-seedance-2-0-260128', 'provider-model-ark', ProviderCode::VolcengineArk)
            ));

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $pointComponent,
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $enqueueResponse = $service->enqueue('token-ark', $requestDTO);
        $storedOperation = $operationRepository->operations[$enqueueResponse->getId()];

        $this->assertSame(5, $storedOperation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $storedOperation->getRawRequest()['generation']['resolution']);
        $this->assertTrue($storedOperation->getRawRequest()['generation']['generate_audio']);
        $this->assertSame(ProviderCode::VolcengineArk->value, $storedOperation->getProviderCode());
        $this->assertSame('doubao-seedance-2-0-260128', $storedOperation->getModelVersion());
        $this->assertSame('doubao-seedance-2-0-260128', $storedOperation->getProviderPayload()['model']);
        $this->assertTrue($storedOperation->getProviderPayload()['generate_audio']);
        $this->assertSame('make a cinematic drone shot', $storedOperation->getProviderPayload()['content'][0]['text']);
        $this->assertSame('720p', $storedOperation->getProviderPayload()['resolution']);
        $this->assertSame(5, $storedOperation->getProviderPayload()['duration']);

        $detailResponse = $service->getOperation('token-ark', $enqueueResponse->getId());

        $this->assertSame('succeeded', $detailResponse->getStatus());
        $this->assertSame('https://example.com/ark-seedance.mp4', $detailResponse->getOutput()['video_url']);
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(5, $event->getDurationSeconds());
        $this->assertSame('720p', $event->getResolution());
        $this->assertSame('1280x720', $event->getSize());
    }

    public function testGetOperationDispatchesGeneratedEventWithProbedBase64VideoMetadata(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = $this->createOperation('op-probe-base64');
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId('provider-task-probe-base64');
        $operation->setStartedAt(date(DATE_ATOM));

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations[$operation->getId()] = $operation;
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'unused',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [],
                    'provider_result' => [
                        'response' => [
                            'videos' => [[
                                'bytesBase64Encoded' => base64_encode('fake-video-binary'),
                                'mimeType' => 'video/mp4',
                            ]],
                        ],
                    ],
                ],
            ),
        );

        $probeCalled = false;
        $probe = new CallbackVideoMediaProbe(function (string $filePath) use (&$probeCalled): VideoMediaMetadata {
            $probeCalled = true;
            $this->assertFileExists($filePath);
            $this->assertStringEndsWith('.mp4', $filePath);

            return new VideoMediaMetadata(8.11, 1080, 1920);
        });

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-probe-base64', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $probe,
        );

        $response = $service->getOperation('token-probe-base64', $operation->getId(), ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertTrue($probeCalled);
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(9, $event->getDurationSeconds());
        $this->assertSame('1080p', $event->getResolution());
        $this->assertSame('1080x1920', $event->getSize());
        $this->assertSame(1080, $event->getWidth());
        $this->assertSame(1920, $event->getHeight());
    }

    public function testGetOperationDispatchesGeneratedEventWithDownloadedVideoMetadata(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = $this->createOperation('op-probe-remote');
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId('provider-task-probe-remote');
        $operation->setStartedAt(date(DATE_ATOM));

        MockHttpsStreamWrapper::setBody('https://example.com/probe-remote.mp4', 'downloaded-video-binary');

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations[$operation->getId()] = $operation;
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'unused',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/probe-remote.mp4',
                    ],
                ],
            ),
        );

        $probeCalled = false;
        $probe = new CallbackVideoMediaProbe(function (string $filePath) use (&$probeCalled): VideoMediaMetadata {
            $probeCalled = true;
            $this->assertFileExists($filePath);
            $this->assertSame('downloaded-video-binary', file_get_contents($filePath));

            return new VideoMediaMetadata(8.02, 1920, 1080);
        });

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-probe-remote', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $probe,
        );

        $response = $service->getOperation('token-probe-remote', $operation->getId(), ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertTrue($probeCalled);
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(8, $event->getDurationSeconds());
        $this->assertSame('1080p', $event->getResolution());
        $this->assertSame('1920x1080', $event->getSize());
        $this->assertSame(1920, $event->getWidth());
        $this->assertSame(1080, $event->getHeight());
    }

    public function testGetOperationFallsBackToExplicitRequestDimensionsWhenProbeFails(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = $this->createOperation('op-probe-fallback');
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId('provider-task-probe-fallback');
        $operation->setStartedAt(date(DATE_ATOM));
        $operation->setRawRequest([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'prompt' => 'make a fallback video',
            'generation' => [
                'size' => '1080x1920',
                'duration_seconds' => 8,
                'resolution' => '1080p',
            ],
        ]);
        $operation->setProviderPayload([
            'resolution' => '720p',
            'size' => '720p',
            'durationSeconds' => 5,
        ]);

        MockHttpsStreamWrapper::setBody('https://example.com/probe-fallback.mp4', 'downloaded-video-binary');

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations[$operation->getId()] = $operation;
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'unused',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/probe-fallback.mp4',
                    ],
                ],
            ),
        );

        $logger = new RecordingLogger();
        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-probe-fallback', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );
        $service->logger = $logger;

        $response = $service->getOperation('token-probe-fallback', $operation->getId(), ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(8, $event->getDurationSeconds());
        $this->assertSame('1080p', $event->getResolution());
        $this->assertSame('1080x1920', $event->getSize());
        $this->assertSame(1080, $event->getWidth());
        $this->assertSame(1920, $event->getHeight());
        $this->assertTrue($logger->hasRecord('warning', 'video billing probe failed'));
        $this->assertTrue($logger->hasRecord('warning', 'video billing probe fallback'));
    }

    public function testGetOperationQueriesProviderAndPersistsLatestState(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = $this->createOperation('op-2');
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId('provider-task-2');
        $operation->setStartedAt(date(DATE_ATOM));
        $operation->setTopicId('topic-1');
        $operation->setTaskId('task-1');
        $operation->setSourceId('design_video_generation');
        $operation->setProjectId(1001);
        $operation->setRawRequest([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'prompt' => 'make a video',
            'generation' => [
                'size' => '1280x720',
                'aspect_ratio' => '16:9',
                'duration_seconds' => 10,
                'resolution' => '720p',
            ],
        ]);
        $operation->setProviderPayload([
            'prompt' => 'make a video',
            'aspectRatio' => '16:9',
            'size' => '1080p',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-2'] = $operation;
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-ignored',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/video.mp4',
                    ],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->exactly(2))
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-2', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );
        $logger = new RecordingLogger();
        $service->logger = $logger;

        $response = $service->getOperation('token-2', 'op-2', ['organization_id' => 'org-test']);

        $this->assertSame('op-2', $response->getId());
        $this->assertSame('succeeded', $response->getStatus());
        $this->assertNull($response->getQueue()?->getPosition());
        $this->assertSame(0, $response->getQueue()?->getRunningCount());
        $this->assertSame('https://example.com/video.mp4', $response->getOutput()['video_url']);
        $this->assertArrayNotHasKey('provider', $response->toArray());
        $this->assertSame(VideoOperationStatus::SUCCEEDED, $operationRepository->operations['op-2']->getStatus());

        $events = $this->eventDispatcher->events;
        $this->assertCount(1, $events);
        $this->assertInstanceOf(VideoGeneratedEvent::class, $events[0]);
        /** @var VideoGeneratedEvent $event */
        $event = $events[0];
        $this->assertSame('org-test', $event->getOrganizationCode());
        $this->assertSame('user-test', $event->getUserId());
        $this->assertSame('veo-3.1-fast-generate-preview', $event->getModel());
        $this->assertSame(10, $event->getDurationSeconds());
        $this->assertSame('720p', $event->getResolution());
        $this->assertSame('1280x720', $event->getSize());
        $this->assertSame(1280, $event->getWidth());
        $this->assertSame(720, $event->getHeight());
        $this->assertSame(1001, $event->getProjectId());
        $this->assertSame('topic-1', $event->getTopicId());
        $this->assertSame('task-1', $event->getTaskId());
        $this->assertSame('design_video_generation', $event->getSourceId());

        $secondResponse = $service->getOperation('token-2', 'op-2', ['organization_id' => 'org-test']);
        $this->assertSame('succeeded', $secondResponse->getStatus());
        $this->assertCount(1, $this->eventDispatcher->events);
        $this->assertTrue($logger->hasRecord('info', 'video provider query summary'));
        $this->assertTrue($logger->hasRecord('info', 'video operation status changed'));
    }

    public function testGetOperationNormalizesKelingModeToBillingResolution(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-billing',
            endpoint: 'video:keling-3.0-video',
            model: 'keling-3.0-video',
            modelVersion: 'YGNqszpCuuWLpyUt',
            providerModelId: 'provider-model-keling',
            providerCode: ProviderCode::Cloudsway->value,
            providerName: 'cloudsway',
            organizationCode: 'org-test',
            userId: 'user-test',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 0,
            rawRequest: [
                'model_id' => 'keling-3.0-video',
                'prompt' => 'make a keling video',
                'generation' => [
                    'duration_seconds' => 5,
                    'aspect_ratio' => '9:16',
                ],
            ],
            providerPayload: [
                'model_name' => 'kling-v3',
                'prompt' => 'make a keling video',
                'mode' => 'pro',
                'aspect_ratio' => '9:16',
                'duration' => '5',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
        $operation->setProviderTaskId('provider-task-keling');
        $operation->setStartedAt(date(DATE_ATOM));
        $operation->setProjectId(2002);
        $operation->setTopicId('topic-keling');
        $operation->setTaskId('task-keling');

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-keling-billing'] = $operation;
        $videoQueueDomainService = new VideoQueueDomainService($operationRepository);
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-ignored',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [
                        'video_url' => 'https://example.com/keling.mp4',
                    ],
                ],
            ),
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-keling', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            $videoQueueDomainService,
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $response = $service->getOperation('token-keling', 'op-keling-billing', ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertCount(1, $this->eventDispatcher->events);
        $event = $this->eventDispatcher->events[0];
        $this->assertInstanceOf(VideoGeneratedEvent::class, $event);
        $this->assertSame(5, $event->getDurationSeconds());
        $this->assertSame('1080p', $event->getResolution());
        $this->assertSame('1920x1080', $event->getSize());
        $this->assertSame(1920, $event->getWidth());
        $this->assertSame(1080, $event->getHeight());
        $this->assertSame(2002, $event->getProjectId());
    }

    public function testGetOperationUploadsCloudswayVeoBase64ResultToPublicUrl(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $privateStorageHash = md5(StorageBucketType::Private->value);
        $operation = new VideoQueueOperationEntity(
            id: 'op-3',
            endpoint: 'video:test',
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: 'LCnVzCkkMnVulyrz',
            providerModelId: 'provider-model',
            providerCode: ProviderCode::Cloudsway->value,
            providerName: 'cloudsway',
            organizationCode: 'org-test',
            userId: 'user-test',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 0,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
        $operation->setProviderTaskId('provider-task-3');
        $operation->setStartedAt(date(DATE_ATOM));

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-3'] = $operation;
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            new RecordingQueueOperationExecutor(
                submitResult: 'provider-task-ignored',
                queryResult: [
                    'status' => 'succeeded',
                    'output' => [],
                    'provider_result' => [
                        'done' => true,
                        'response' => [
                            'videos' => [[
                                'bytesBase64Encoded' => base64_encode('fake-video-binary'),
                                'mimeType' => 'video/mp4',
                            ]],
                        ],
                    ],
                ],
            ),
        );

        $cloudFileRepository = new InMemoryCloudFileRepository();
        $fileDomainService = new FileDomainService($cloudFileRepository);

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-3', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            $fileDomainService,
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $response = $service->getOperation('token-3', 'op-3', ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertSame(
            'https://cdn.example.com/org-test/open/' . $privateStorageHash . '/open/video-generation/op-3.mp4',
            $response->getOutput()['video_url']
        );
        $this->assertSame(VideoOperationStatus::SUCCEEDED, $operationRepository->operations['op-3']->getStatus());
        $providerResult = $operationRepository->operations['op-3']->getProviderResult();
        $this->assertIsArray($providerResult);
        $this->assertArrayNotHasKey('bytesBase64Encoded', $providerResult['response']['videos'][0]);
        $this->assertCount(1, $cloudFileRepository->uploadRecords);
        $this->assertSame('org-test', $cloudFileRepository->uploadRecords[0]['organization_code']);
        $this->assertSame(StorageBucketType::Private, $cloudFileRepository->uploadRecords[0]['bucket_type']);
        $this->assertTrue($cloudFileRepository->uploadRecords[0]['auto_dir']);
        $this->assertSame('video/mp4', $cloudFileRepository->uploadRecords[0]['content_type']);
        $this->assertSame(
            'org-test/open/' . $privateStorageHash . '/open/video-generation/op-3.mp4',
            $cloudFileRepository->uploadRecords[0]['file_key']
        );
        $this->assertSame('org-test/open/' . $privateStorageHash . '/open/video-generation', $operationRepository->operations['op-3']->getFileDir());
        $this->assertSame('op-3.mp4', $operationRepository->operations['op-3']->getFileName());
    }

    public function testGetOperationResignsStoredPrivateVideoUrlForSucceededOperation(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $privateStorageHash = md5(StorageBucketType::Private->value);
        $operation = $this->createOperation('op-4');
        $operation->setStatus(VideoOperationStatus::SUCCEEDED);
        $operation->setStartedAt(date(DATE_ATOM));
        $operation->setFinishedAt(date(DATE_ATOM));
        $operation->setFileDir('org-test/open/' . $privateStorageHash . '/open/video-generation');
        $operation->setFileName('op-4.mp4');
        $operation->setOutput([
            'video_url' => 'https://expired.example.com/op-4.mp4',
        ]);

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations['op-4'] = $operation;
        $executor = new RecordingQueueOperationExecutor(
            submitResult: 'provider-task-ignored',
            queryResult: ['status' => 'processing'],
        );
        $executionDomainService = new QueueOperationExecutionDomainService(
            new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
            $executor,
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-4', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            $executionDomainService,
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $response = $service->getOperation('token-4', 'op-4', ['organization_id' => 'org-test']);

        $this->assertSame('succeeded', $response->getStatus());
        $this->assertSame(
            'https://cdn.example.com/org-test/open/' . $privateStorageHash . '/open/video-generation/op-4.mp4',
            $response->getOutput()['video_url']
        );
        $this->assertSame('https://expired.example.com/op-4.mp4', $operationRepository->operations['op-4']->getOutput()['video_url']);
        $this->assertSame(0, $executor->queryCalls);
    }

    public function testEnqueueReturnsProviderMessageWhenProviderRejectsCreateRequest(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
        ]);

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-provider-error', [])
            ->willReturn($dataIsolation);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->once())
            ->method('checkPointsSufficient')
            ->with($requestDTO, $dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->willReturn($this->createVideoModelEntry(new VideoModel([], 'LCnVzCkkMnVulyrz', 'provider-model', ProviderCode::Cloudsway)));

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService(new InMemoryVideoQueueOperationRepository()),
            new QueueOperationExecutionDomainService(
                new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
                new RecordingQueueOperationExecutor(
                    submitResult: 'unused',
                    submitThrowable: new ProviderVideoException('provider says duration_seconds=9 is invalid'),
                ),
            ),
            $pointComponent,
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('provider says duration_seconds=9 is invalid');
        $service->enqueue('token-provider-error', $requestDTO);
    }

    public function testGetOperationMarksFailedWithProviderQueryMessage(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operation = $this->createOperation('op-provider-query-error');
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId('provider-task-error');
        $operation->setStartedAt(date(DATE_ATOM));

        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $operationRepository->operations[$operation->getId()] = $operation;

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-provider-query-error', ['organization_id' => 'org-test'])
            ->willReturn($dataIsolation);

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            new QueueOperationExecutionDomainService(
                new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20)),
                new RecordingQueueOperationExecutor(
                    submitResult: 'unused',
                    queryThrowable: new ProviderVideoException('provider says operationName is invalid'),
                ),
            ),
            $this->createMock(PointComponentInterface::class),
            $this->createMock(ModelGatewayMapper::class),
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $response = $service->getOperation('token-provider-query-error', $operation->getId(), ['organization_id' => 'org-test']);

        $this->assertSame('failed', $response->getStatus());
        $this->assertSame('provider says operationName is invalid', $response->getError()?->getMessage());
        $this->assertSame(VideoOperationStatus::FAILED, $operationRepository->operations[$operation->getId()]->getStatus());
    }

    public function testGetOperationFallsBackToProviderTaskIdWhenStoredOperationIsMissing(): void
    {
        $dataIsolation = $this->createDataIsolation();
        $operationRepository = new InMemoryVideoQueueOperationRepository();
        $executor = new RecordingQueueOperationExecutor(
            submitResult: 'unused',
            queryResult: [
                'status' => 'running',
                'output' => [],
            ],
        );

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('createModelGatewayDataIsolationByAccessToken')
            ->with('token-provider-fallback', [
                'organization_code' => 'org-test',
                'user_id' => 'user-test',
                'model_id' => 'doubao-seedance-2-0-fast-260128',
                'video_id' => 'video-task-123',
                'provider_task_id' => 'cgt-provider-task-123',
            ])
            ->willReturn($dataIsolation);

        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($dataIsolation, 'doubao-seedance-2-0-fast-260128')
            ->willReturn($this->createVideoModelEntry(
                new VideoModel([], 'doubao-seedance-2-0-fast-260128', 'provider-model-ark', ProviderCode::VolcengineArk)
            ));

        $service = new VideoOperationAppService(
            $llmAppService,
            new VideoQueueDomainService($operationRepository),
            new QueueOperationExecutionDomainService(
                new FixedQueueExecutorConfigRepository(new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20)),
                $executor,
            ),
            $this->createMock(PointComponentInterface::class),
            $modelGatewayMapper,
            $this->createVideoGenerationConfigDomainService(),
            new FileDomainService(new InMemoryCloudFileRepository()),
            $this->createVideoBillingDetailsResolver(),
            $this->createFallbackProbe(),
        );

        $response = $service->getOperation('token-provider-fallback', 'video-task-123', [
            'organization_code' => 'org-test',
            'user_id' => 'user-test',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'video_id' => 'video-task-123',
            'provider_task_id' => 'cgt-provider-task-123',
        ]);

        $this->assertSame('video-task-123', $response->getId());
        $this->assertSame('running', $response->getStatus());
        $this->assertSame('cgt-provider-task-123', $response->getProviderTaskId());
        $this->assertSame(['cgt-provider-task-123'], $executor->queriedProviderTaskIds);
        $this->assertCount(1, $executor->queriedOperations);
        $this->assertSame('video-task-123', $executor->queriedOperations[0]->getId());
        $this->assertSame('video-task-123', $executor->queriedOperations[0]->getVideoId());
        $this->assertSame('doubao-seedance-2-0-fast-260128', $executor->queriedOperations[0]->getModel());
        $this->assertArrayHasKey('video-task-123', $operationRepository->operations);
    }

    private function createVideoModelEntry(VideoModel $videoModel): ModelEntry
    {
        return new ModelEntry(
            new ModelAttributes(
                key: $videoModel->getProviderModelId(),
                name: $videoModel->getModelVersion(),
                label: $videoModel->getModelVersion(),
                icon: '',
                tags: [],
                createdAt: new DateTime(),
                owner: 'MagicAI',
                providerModelId: $videoModel->getProviderModelId(),
                modelType: 5,
            ),
            $videoModel,
        );
    }

    private function createVideoBillingDetailsResolver(): VideoBillingDetailsResolver
    {
        return new VideoBillingDetailsResolver();
    }

    private function createFallbackProbe(): VideoMediaProbeInterface
    {
        return new CallbackVideoMediaProbe(static function (string $filePath): VideoMediaMetadata {
            throw new RuntimeException(sprintf('ffprobe failed for %s', $filePath));
        });
    }

    private function createOperation(string $id): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: $id,
            endpoint: 'video:test',
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: 'LCnVzCkkMnVulyrz',
            providerModelId: 'provider-model',
            providerCode: ProviderCode::Cloudsway->value,
            providerName: 'cloudsway',
            organizationCode: 'org-test',
            userId: 'user-test',
            status: VideoOperationStatus::QUEUED,
            seq: 0,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createDataIsolation(AccessTokenType $accessTokenType = AccessTokenType::Application): ModelGatewayDataIsolation
    {
        $dataIsolation = ModelGatewayDataIsolation::create('org-test', 'user-test');
        $accessTokenEntity = new AccessTokenEntity();
        $accessTokenEntity->setId(9527);
        $accessTokenEntity->setName($accessTokenType->isUser() ? 'user-token' : 'app-token');
        $accessTokenEntity->setType($accessTokenType);
        $dataIsolation->setAccessToken($accessTokenEntity);

        return $dataIsolation;
    }

    private function createVideoGenerationConfigDomainService(): VideoGenerationConfigDomainService
    {
        return new VideoGenerationConfigDomainService(
            new VideoGenerateFactory(
                new CloudswayVideoAdapterRouter(
                    new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                ),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class))),
            )
        );
    }
}

final class InMemoryVideoQueueOperationRepository implements VideoQueueOperationRepositoryInterface
{
    /** @var array<string, VideoQueueOperationEntity> */
    public array $operations = [];

    public function getOperation(string $operationId): ?VideoQueueOperationEntity
    {
        return $this->operations[$operationId] ?? null;
    }

    public function getOperations(array $operationIds): array
    {
        return array_values(array_filter(
            array_map(fn (string $operationId): ?VideoQueueOperationEntity => $this->operations[$operationId] ?? null, $operationIds)
        ));
    }

    public function saveOperation(VideoQueueOperationEntity $operation, int $ttlSeconds): void
    {
        $this->operations[$operation->getId()] = clone $operation;
    }

    public function deleteOperation(string $operationId): void
    {
        unset($this->operations[$operationId]);
    }

    public function addActiveOperation(VideoQueueOperationEntity $operation): void
    {
    }

    public function removeActiveOperation(VideoQueueOperationEntity $operation): void
    {
    }
}

final readonly class FixedQueueExecutorConfigRepository implements QueueExecutorConfigRepositoryInterface
{
    public function __construct(
        private QueueExecutorConfig $config,
    ) {
    }

    public function getConfig(string $modelId, string $organizationCode): QueueExecutorConfig
    {
        return $this->config;
    }
}

final class RecordingQueueOperationExecutor implements QueueOperationExecutorInterface
{
    public int $queryCalls = 0;

    /** @var list<VideoQueueOperationEntity> */
    public array $submittedOperations = [];

    /** @var list<VideoQueueOperationEntity> */
    public array $queriedOperations = [];

    /** @var list<string> */
    public array $queriedProviderTaskIds = [];

    public function __construct(
        private readonly string $submitResult,
        private readonly array $queryResult = [],
        private readonly ?Throwable $submitThrowable = null,
        private readonly ?Throwable $queryThrowable = null,
    ) {
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        if ($this->submitThrowable instanceof Throwable) {
            throw $this->submitThrowable;
        }

        $this->submittedOperations[] = clone $operation;

        return $this->submitResult;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        if ($this->queryThrowable instanceof Throwable) {
            throw $this->queryThrowable;
        }

        ++$this->queryCalls;
        $this->queriedOperations[] = clone $operation;
        $this->queriedProviderTaskIds[] = $providerTaskId;
        return $this->queryResult;
    }
}

final class InMemoryCloudFileRepository implements CloudFileRepositoryInterface
{
    public array $uploadRecords = [];

    /** @var array<string, FileLink> */
    private array $links = [];

    public function getLinks(string $organizationCode, array $filePaths, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): array
    {
        $links = [];
        foreach ($filePaths as $filePath) {
            $normalizedFilePath = ltrim($filePath, '/');
            if (! isset($this->links[$normalizedFilePath])) {
                $this->links[$normalizedFilePath] = new FileLink(
                    $normalizedFilePath,
                    'https://cdn.example.com/' . $normalizedFilePath,
                    time() + 3600,
                );
            }
            $links[$normalizedFilePath] = $this->links[$normalizedFilePath];
        }

        return $links;
    }

    public function uploadByCredential(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null, array $options = []): void
    {
        $prefix = $autoDir
            ? $organizationCode . '/open/' . md5($storage->value) . '/'
            : '';
        $fileKey = $prefix . ltrim($uploadFile->getKeyPath(), '/');
        $uploadFile->setKey($fileKey);
        $this->uploadRecords[] = [
            'organization_code' => $organizationCode,
            'file_key' => $fileKey,
            'bucket_type' => $storage,
            'auto_dir' => $autoDir,
            'content_type' => $contentType,
        ];
        $this->links[$fileKey] = new FileLink(
            $fileKey,
            'https://cdn.example.com/' . $fileKey,
            time() + 3600,
        );
    }

    public function uploadByChunks(string $organizationCode, ChunkUploadFile $chunkUploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void
    {
    }

    public function upload(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void
    {
    }

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null, bool $sts = false): array
    {
        return [];
    }

    public function downloadByChunks(string $organizationCode, string $filePath, string $localPath, ?StorageBucketType $bucketType = null, array $options = []): void
    {
    }

    public function getStsTemporaryCredential(string $organizationCode, StorageBucketType $bucketType = StorageBucketType::Private, string $dir = '', int $expires = 3600, bool $autoBucket = true, array $options = []): array
    {
        return [];
    }

    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        $urls = [];
        foreach ($fileNames as $fileName) {
            $urls[$fileName] = new FilePreSignedUrl(
                basename((string) $fileName),
                'https://cdn.example.com/' . ltrim((string) $fileName, '/'),
                [],
                $expires,
                ltrim((string) $fileName, '/'),
            );
        }

        return $urls;
    }

    public function getMetas(array $paths, string $organizationCode, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        return [];
    }

    public function getDefaultIconPaths(string $appId = 'open'): array
    {
        return [];
    }

    public function deleteFile(string $organizationCode, string $filePath, StorageBucketType $bucketType = StorageBucketType::Private): bool
    {
        return true;
    }

    public function listObjectsByCredential(string $organizationCode, string $prefix = '', StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): array
    {
        return [];
    }

    public function deleteObjectByCredential(string $prefix, string $organizationCode, string $objectKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function copyObjectByCredential(string $prefix, string $organizationCode, string $sourceKey, string $destinationKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function getHeadObjectByCredential(string $organizationCode, string $objectKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): array
    {
        return [];
    }

    public function setHeadObjectByCredential(string $organizationCode, string $objectKey, array $metadata, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function createObjectByCredential(string $prefix, string $organizationCode, string $objectKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function createFolderByCredential(string $prefix, string $organizationCode, string $folderPath, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function createFileByCredential(string $prefix, string $organizationCode, string $filePath, string $content = '', StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function renameObjectByCredential(string $prefix, string $organizationCode, string $sourceKey, string $destinationKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): void
    {
    }

    public function getPreSignedUrlByCredential(string $organizationCode, string $objectKey, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): string
    {
        return 'https://cdn.example.com/' . ltrim($objectKey, '/');
    }

    public function deleteObjectsByCredential(string $prefix, string $organizationCode, array $objectKeys, StorageBucketType $bucketType = StorageBucketType::Private, array $options = []): array
    {
        return [];
    }

    public function getFullPrefix(string $organizationCode): string
    {
        return $organizationCode;
    }

    public function generateWorkDir(string $userId, int $projectId, string $code, string $lastPath): string
    {
        return '';
    }
}

final readonly class CallbackVideoMediaProbe implements VideoMediaProbeInterface
{
    /**
     * @param callable(string): VideoMediaMetadata $callback
     */
    public function __construct(
        private mixed $callback,
    ) {
    }

    public function probe(string $filePath): VideoMediaMetadata
    {
        return ($this->callback)($filePath);
    }
}

final class RecordingLogger extends AbstractLogger
{
    /** @var list<array{level: string, message: string, context: array}> */
    public array $records = [];

    public function log($level, $message, array $context = []): void
    {
        $this->records[] = [
            'level' => (string) $level,
            'message' => (string) $message,
            'context' => $context,
        ];
    }

    public function hasRecord(string $level, string $message): bool
    {
        foreach ($this->records as $record) {
            if ($record['level'] === $level && $record['message'] === $message) {
                return true;
            }
        }

        return false;
    }
}

final class MockHttpsStreamWrapper
{
    public mixed $context = null;

    /** @var array<string, string> */
    private static array $bodies = [];

    private static bool $registered = false;

    private static string $defaultBody = 'mock-video-binary';

    private int $position = 0;

    private string $body = '';

    public static function register(): void
    {
        if (self::$registered) {
            return;
        }

        if (! @stream_wrapper_unregister('https')) {
            throw new RuntimeException('failed to unregister https stream wrapper');
        }
        if (! stream_wrapper_register('https', self::class)) {
            stream_wrapper_restore('https');
            throw new RuntimeException('failed to register mock https stream wrapper');
        }

        self::$registered = true;
    }

    public static function restore(): void
    {
        self::reset();
        if (! self::$registered) {
            return;
        }

        stream_wrapper_restore('https');
        self::$registered = false;
    }

    public static function reset(): void
    {
        self::$bodies = [];
        self::$defaultBody = 'mock-video-binary';
    }

    public static function setBody(string $url, string $body): void
    {
        self::$bodies[$url] = $body;
    }

    public function stream_open(string $path, string $mode, int $options, ?string &$openedPath): bool
    {
        $this->body = self::$bodies[$path] ?? self::$defaultBody;
        $this->position = 0;

        return true;
    }

    public function stream_read(int $count): string
    {
        $chunk = substr($this->body, $this->position, $count);
        $this->position += strlen($chunk);

        return $chunk;
    }

    public function stream_eof(): bool
    {
        return $this->position >= strlen($this->body);
    }

    public function stream_seek(int $offset, int $whence = SEEK_SET): bool
    {
        $length = strlen($this->body);
        $nextPosition = match ($whence) {
            SEEK_CUR => $this->position + $offset,
            SEEK_END => $length + $offset,
            default => $offset,
        };

        if ($nextPosition < 0 || $nextPosition > $length) {
            return false;
        }

        $this->position = $nextPosition;
        return true;
    }

    public function stream_stat(): array
    {
        return [
            'size' => strlen($this->body),
        ];
    }

    public function url_stat(string $path, int $flags): array
    {
        $body = self::$bodies[$path] ?? self::$defaultBody;

        return [
            'size' => strlen($body),
        ];
    }
}

final class RecordingEventDispatcher implements EventDispatcherInterface
{
    /** @var list<object> */
    public array $events = [];

    public function dispatch(object $event): object
    {
        $this->events[] = $event;

        return $event;
    }
}

final readonly class EventDispatcherContainer implements ContainerInterface
{
    private ConfigInterface $config;

    private LoggerFactory $loggerFactory;

    public function __construct(
        private EventDispatcherInterface $eventDispatcher,
        private ContainerInterface $fallbackContainer,
    ) {
        $this->config = new class implements ConfigInterface {
            private array $items = [
                'app_env' => 'unit',
                'app_name' => 'magic-service-test',
                'service_provider.office_organization' => '',
            ];

            public function __construct()
            {
                $this->items['error_message'] = require dirname(__DIR__, 5) . '/config/autoload/error_message.php';
            }

            public function get(string $key, mixed $default = null): mixed
            {
                return $this->items[$key] ?? $default;
            }

            public function has(string $keys): bool
            {
                return array_key_exists($keys, $this->items);
            }

            public function set(string $key, mixed $value): void
            {
                $this->items[$key] = $value;
            }
        };

        $this->loggerFactory = new class extends LoggerFactory {
            public function __construct()
            {
            }

            public function make($name = 'hyperf', $group = 'default'): LoggerInterface
            {
                return new NullLogger();
            }

            public function get($name = 'hyperf', $group = 'default'): LoggerInterface
            {
                return new NullLogger();
            }
        };
    }

    public function get(string $id)
    {
        return $this->resolve($id);
    }

    public function make(string $name, array $parameters = []): mixed
    {
        if ($this->has($name)) {
            return $this->resolve($name);
        }

        if (method_exists($this->fallbackContainer, 'make')) {
            return $this->fallbackContainer->make($name, $parameters);
        }

        return $this->fallbackContainer->get($name);
    }

    public function has(string $id): bool
    {
        return in_array($id, [
            EventDispatcherInterface::class,
            ConfigInterface::class,
            ThirdPlatformDataIsolationManagerInterface::class,
            SubscriptionManagerInterface::class,
            OrganizationInfoManagerInterface::class,
            PhpSerializerPacker::class,
            LoggerFactory::class,
        ], true) || $this->fallbackContainer->has($id);
    }

    private function resolve(string $id): mixed
    {
        return match ($id) {
            EventDispatcherInterface::class => $this->eventDispatcher,
            ConfigInterface::class => $this->config,
            ThirdPlatformDataIsolationManagerInterface::class => new BaseThirdPlatformDataIsolationManager(),
            SubscriptionManagerInterface::class => new BaseSubscriptionManager(),
            OrganizationInfoManagerInterface::class => new BaseOrganizationInfoManager(),
            PhpSerializerPacker::class => new PhpSerializerPacker(),
            LoggerFactory::class => $this->loggerFactory,
            default => $this->fallbackContainer->get($id),
        };
    }
}
