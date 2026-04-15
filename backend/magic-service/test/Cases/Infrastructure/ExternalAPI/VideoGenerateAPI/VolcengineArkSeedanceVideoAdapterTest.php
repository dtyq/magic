<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VolcengineArkSeedanceVideoAdapterTest extends TestCase
{
    public function testSupportsModelAcceptsDynamicVolcengineArkModelIdentifiers(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $this->assertTrue($adapter->supportsModel('seedance-v-next-build-001', ''));
        $this->assertTrue($adapter->supportsModel('', 'seedance-v-next-build-001'));
        $this->assertFalse($adapter->supportsModel('', ''));
    }

    public function testBuildProviderPayloadMapsGenerateEditAndAudioVideoInputsWithoutServiceTierForProModel(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-1',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'edit',
                'prompt' => 'replace the sky with sunset clouds',
                'inputs' => [
                    'video' => ['uri' => 'https://example.com/source.mp4'],
                    'mask' => ['uri' => 'https://example.com/mask.png'],
                    'audio' => [
                        ['role' => 'reference', 'uri' => 'https://example.com/voice.wav'],
                    ],
                ],
                'generation' => [
                    'camera_fixed' => true,
                    'aspect_ratio' => '16:9',
                    'duration_seconds' => 5,
                    'resolution' => '1080p',
                    'seed' => 7,
                    'watermark' => true,
                    'return_last_frame' => true,
                    'generate_audio' => true,
                ],
                'callbacks' => [
                    'webhook_url' => 'https://callback.example.com/video',
                ],
                'execution' => [
                    'service_tier' => 'flex',
                    'expires_after_seconds' => 7200,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('doubao-seedance-2-0-260128', $payload['model']);
        $this->assertSame('edit', $payload['task']);
        $this->assertSame('replace the sky with sunset clouds --rs 1080p --rt 16:9 --dur 5 --seed 7 --wm true --cf true', $payload['content'][0]['text']);
        $this->assertSame('https://example.com/source.mp4', $payload['content'][1]['video_url']['url']);
        $this->assertSame('https://example.com/voice.wav', $payload['content'][2]['audio_url']['url']);
        $this->assertSame('https://example.com/mask.png', $payload['content'][3]['mask_url']['url']);
        $this->assertSame('https://callback.example.com/video', $payload['callback_url']);
        $this->assertArrayNotHasKey('service_tier', $payload);
        $this->assertSame(7200, $payload['execution_expires_after']);
        $this->assertTrue($payload['return_last_frame']);
        $this->assertTrue($payload['generate_audio']);
        $this->assertArrayNotHasKey('watermark', $payload);
    }

    public function testBuildProviderPayloadDropsServiceTierForFastModelToo(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-fast-tier',
            endpoint: 'video:doubao-seedance-2-0-fast-260128',
            model: 'doubao-seedance-2-0-fast-260128',
            modelVersion: 'doubao-seedance-2-0-fast-260128',
            providerModelId: 'provider-model-ark-seedance-fast',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-fast-260128',
                'task' => 'generate',
                'prompt' => 'make a fast video',
                'execution' => [
                    'service_tier' => 'flex',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertArrayNotHasKey('service_tier', $payload);
    }

    public function testBuildProviderPayloadMapsStartAndEndFramesWithoutDroppingThem(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-frames',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => 'animate these frames',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ['role' => 'end', 'uri' => 'https://example.com/end.png'],
                    ],
                    'reference_images' => [
                        ['uri' => 'https://example.com/reference.png'],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('https://example.com/start.png', $payload['content'][1]['image_url']['url']);
        $this->assertSame('first_frame', $payload['content'][1]['role']);
        $this->assertSame('https://example.com/end.png', $payload['content'][2]['image_url']['url']);
        $this->assertSame('last_frame', $payload['content'][2]['role']);
        $this->assertSame('https://example.com/reference.png', $payload['content'][3]['image_url']['url']);
    }

    public function testQueryMapsQueuedRunningSucceededFailedExpiredAndCancelledResponses(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->exactly(6))
            ->method('get')
            ->willReturnOnConsecutiveCalls(
                new Response(200, [], json_encode(['id' => 'task-queued', 'status' => 'queued'], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode(['id' => 'task-running', 'status' => 'running'], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-succeeded',
                    'status' => 'succeeded',
                    'content' => [
                        'video_url' => 'https://example.com/generated.mp4',
                        'last_frame_url' => 'https://example.com/last-frame.png',
                    ],
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-failed',
                    'status' => 'failed',
                    'message' => 'provider failed',
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-expired',
                    'status' => 'expired',
                    'message' => 'task expired',
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-cancelled',
                    'status' => 'cancelled',
                    'message' => 'task cancelled',
                ], JSON_THROW_ON_ERROR)),
            );

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->exactly(6))
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory));
        $operation = $this->createOperation();
        $config = new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20);

        $queued = $adapter->query($operation, $config, 'task-queued');
        $running = $adapter->query($operation, $config, 'task-running');
        $succeeded = $adapter->query($operation, $config, 'task-succeeded');
        $failed = $adapter->query($operation, $config, 'task-failed');
        $expired = $adapter->query($operation, $config, 'task-expired');
        $cancelled = $adapter->query($operation, $config, 'task-cancelled');

        $this->assertSame('processing', $queued['status']);
        $this->assertNull($queued['error']);
        $this->assertSame('processing', $running['status']);
        $this->assertNull($running['error']);
        $this->assertSame('succeeded', $succeeded['status']);
        $this->assertSame('https://example.com/generated.mp4', $succeeded['output']['video_url']);
        $this->assertSame('https://example.com/last-frame.png', $succeeded['output']['last_frame_url']);
        $this->assertSame('failed', $failed['status']);
        $this->assertSame('PROVIDER_FAILED', $failed['error']['code']);
        $this->assertSame('failed', $expired['status']);
        $this->assertSame('PROVIDER_EXPIRED', $expired['error']['code']);
        $this->assertSame('failed', $cancelled['status']);
        $this->assertSame('PROVIDER_CANCELLED', $cancelled['error']['code']);
    }

    public function testSubmitHandlesNonJsonErrorBodyWithoutDecodeException(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad gateway',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(502, [], '<html>bad gateway</html>'),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory));

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage('volcengine ark video post failed: HTTP 502');

        $adapter->submit(
            $this->createOperation(),
            new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20),
        );
    }

    private function createOperation(): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-ark-query',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => 'make a video',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
