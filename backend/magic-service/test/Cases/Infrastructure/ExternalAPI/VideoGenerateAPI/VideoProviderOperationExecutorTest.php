<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoProviderOperationExecutor;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class VideoProviderOperationExecutorTest extends TestCase
{
    public function testExecutorRoutesCloudswayProviderUsingOperationModelVersionAsEndpointId(): void
    {
        $operation = $this->createOperation(
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: 'LCnVzCkkMnVulyrz',
            providerCode: ProviderCode::Cloudsway->value,
            rawRequest: [
                'prompt' => 'make a cloudsway video',
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'resolution' => '1080p',
                ],
            ],
        );
        $config = new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://genaiapi.cloudsway.net/v1/ai/LCnVzCkkMnVulyrz/veo/videos/generate',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'instances' => [
                            ['prompt' => 'make a cloudsway video'],
                        ],
                        'parameters' => [
                            'aspectRatio' => '16:9',
                            'resolution' => '1080p',
                            'durationSeconds' => 8,
                        ],
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'name' => 'cloudsway-operation-123',
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($clientFactory),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class))),
            ),
        );

        $this->assertSame('cloudsway-operation-123', $executor->submit($operation, $config));
        $this->assertSame([
            'instances' => [
                ['prompt' => 'make a cloudsway video'],
            ],
            'parameters' => [
                'aspectRatio' => '16:9',
                'resolution' => '1080p',
                'durationSeconds' => 8,
            ],
        ], $operation->getProviderPayload());
    }

    public function testExecutorFailsFastWhenNoAdapterSupportsOperation(): void
    {
        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($this->createMock(ClientFactory::class)),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class))),
            ),
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('video generation adapter not found');

        $executor->submit(
            $this->createOperation(
                model: 'sora-2',
                modelVersion: 'sora2',
                providerCode: ProviderCode::OpenAI->value,
            ),
            new QueueExecutorConfig('https://video-proxy.internal', 'secret', 3, 20),
        );
    }

    public function testExecutorRoutesVolcengineArkProviderUsingSeedanceAdapter(): void
    {
        $operation = $this->createOperation(
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerCode: ProviderCode::VolcengineArk->value,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'edit',
                'prompt' => 'replace the sky',
                'inputs' => [
                    'video' => ['uri' => 'https://example.com/source.mp4'],
                    'mask' => ['uri' => 'https://example.com/mask.png'],
                    'audio' => [
                        ['role' => 'reference', 'uri' => 'https://example.com/voice.wav'],
                    ],
                ],
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'resolution' => '1080p',
                    'duration_seconds' => 5,
                    'watermark' => true,
                    'return_last_frame' => true,
                ],
                'callbacks' => [
                    'webhook_url' => 'https://callback.example.com/video',
                ],
                'execution' => [
                    'service_tier' => 'flex',
                    'expires_after_seconds' => 7200,
                ],
            ],
        );
        $config = new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20);

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
                        'task' => 'edit',
                        'content' => [
                            ['type' => 'text', 'text' => 'replace the sky --rs 1080p --rt 16:9 --dur 5 --wm true'],
                            ['type' => 'video_url', 'video_url' => ['url' => 'https://example.com/source.mp4']],
                            ['type' => 'audio_url', 'audio_url' => ['url' => 'https://example.com/voice.wav', 'role' => 'reference']],
                            ['type' => 'mask_url', 'mask_url' => ['url' => 'https://example.com/mask.png']],
                        ],
                        'callback_url' => 'https://callback.example.com/video',
                        'execution_expires_after' => 7200,
                        'return_last_frame' => true,
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'id' => 'ark-task-123',
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($this->createMock(ClientFactory::class)),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory)),
            ),
        );

        $this->assertSame('ark-task-123', $executor->submit($operation, $config));
        $this->assertSame('doubao-seedance-2-0-260128', $operation->getProviderPayload()['model']);
        $this->assertSame('https://example.com/source.mp4', $operation->getProviderPayload()['content'][1]['video_url']['url']);
    }

    public function testExecutorQueriesVolcengineArkProviderUsingSeedanceAdapter(): void
    {
        $operation = $this->createOperation(
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerCode: ProviderCode::VolcengineArk->value,
        );
        $config = new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/ark-task-123',
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
                    'video_url' => 'https://example.com/ark-query.mp4',
                    'last_frame_url' => 'https://example.com/ark-query-last-frame.png',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($this->createMock(ClientFactory::class)),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory)),
            ),
        );

        $result = $executor->query($operation, $config, 'ark-task-123');

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/ark-query.mp4', $result['output']['video_url']);
        $this->assertSame('https://example.com/ark-query-last-frame.png', $result['output']['last_frame_url']);
        $this->assertSame('ark-task-123', $result['output']['provider_task_id']);
        $this->assertSame('https://ark.cn-beijing.volces.com/api/v3', $result['output']['provider_base_url']);
    }

    private function createOperation(
        string $model = 'veo-3.1-fast-generate-preview',
        string $modelVersion = 'LCnVzCkkMnVulyrz',
        string $providerCode = 'Cloudsway',
        array $rawRequest = ['prompt' => 'make a video'],
    ): VideoQueueOperationEntity {
        return new VideoQueueOperationEntity(
            id: 'op-1',
            endpoint: 'video:' . $model,
            model: $model,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: $providerCode,
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: $rawRequest,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createCloudswayRouter(ClientFactory $clientFactory): CloudswayVideoAdapterRouter
    {
        return new CloudswayVideoAdapterRouter(
            new CloudswayVeoVideoAdapter(new CloudswayVideoClient($clientFactory)),
            new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($clientFactory)),
            new CloudswayKelingVideoAdapter(new CloudswayVideoClient($clientFactory)),
        );
    }
}
