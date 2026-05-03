<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan27VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan27GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class Wan27VideoAdapterTest extends TestCase
{
    public function testBuildProviderPayloadMapsStandardToTextToVideo(): void
    {
        $adapter = $this->createAdapter();
        $operation = $this->createOperation([
            'prompt' => '生成城市日落延时摄影',
            'input_mode' => VideoInputMode::Standard->value,
            'generation' => [
                'resolution' => '1080p',
                'aspect_ratio' => '16:9',
                'duration_seconds' => 8,
                'negative_prompt' => '低清',
                'seed' => 123,
                'watermark' => false,
                'enhance_prompt' => true,
                'generate_audio' => true,
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('wan2.7-t2v', $payload['model']);
        $this->assertSame([
            'prompt' => '生成城市日落延时摄影',
            'negative_prompt' => '低清',
        ], $payload['input']);
        $this->assertSame([
            'resolution' => '1080P',
            'duration' => 8,
            'ratio' => '16:9',
            'seed' => 123,
            'watermark' => false,
            'prompt_extend' => true,
        ], $payload['parameters']);
        $this->assertContains('generation.generate_audio', $operation->getIgnoredParams());
        $this->assertContains('generation.aspect_ratio', $operation->getAcceptedParams());
    }

    public function testBuildProviderPayloadMapsImageReferenceToFirstFrame(): void
    {
        $adapter = $this->createAdapter();
        $operation = $this->createOperation([
            'prompt' => '让参考图动起来',
            'input_mode' => VideoInputMode::ImageReference->value,
            'inputs' => [
                'reference_images' => [
                    ['uri' => 'https://localhost/ref.png'],
                ],
            ],
            'generation' => [
                'resolution' => '720p',
                'duration_seconds' => 5,
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('wan2.7-i2v', $payload['model']);
        $this->assertSame([
            ['type' => 'first_frame', 'url' => 'https://localhost/ref.png'],
        ], $payload['input']['media']);
        $this->assertSame('720P', $payload['parameters']['resolution']);
    }

    public function testBuildProviderPayloadMapsKeyframeGuidedToFirstAndLastFrame(): void
    {
        $adapter = $this->createAdapter();
        $operation = $this->createOperation([
            'prompt' => '从首帧过渡到尾帧',
            'input_mode' => VideoInputMode::KeyframeGuided->value,
            'inputs' => [
                'frames' => [
                    ['role' => 'start', 'uri' => 'https://localhost/start.png'],
                    ['role' => 'end', 'uri' => 'https://localhost/end.png'],
                ],
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('wan2.7-i2v', $payload['model']);
        $this->assertSame([
            ['type' => 'first_frame', 'url' => 'https://localhost/start.png'],
            ['type' => 'last_frame', 'url' => 'https://localhost/end.png'],
        ], $payload['input']['media']);
        $this->assertSame(5, $payload['parameters']['duration']);
    }

    public function testBuildProviderPayloadMapsOmniReferenceToReferenceUrlsAndSize(): void
    {
        $adapter = $this->createAdapter();
        $operation = $this->createOperation([
            'prompt' => '融合图片和视频参考',
            'input_mode' => VideoInputMode::OmniReference->value,
            'inputs' => [
                'reference_images' => [
                    ['uri' => 'https://localhost/ref-1.png'],
                    ['uri' => 'https://localhost/ref-2.png'],
                ],
                'reference_videos' => [
                    ['uri' => 'https://localhost/ref.mp4'],
                ],
            ],
            'generation' => [
                'size' => '1280x720',
                'width' => 1920,
                'height' => 1080,
                'duration_seconds' => 6,
                'watermark' => true,
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('wan2.7-r2v', $payload['model']);
        $this->assertSame([
            'https://localhost/ref-1.png',
            'https://localhost/ref-2.png',
            'https://localhost/ref.mp4',
        ], $payload['input']['reference_urls']);
        $this->assertSame([
            'size' => '1920*1080',
            'duration' => 6,
            'watermark' => true,
        ], $payload['parameters']);
    }

    public function testSubmitExtractsDashScopeTaskId(): void
    {
        $transport = new Wan27FakeDashScopeTransport([
            'output' => ['task_id' => 'task-123'],
        ]);
        $adapter = $this->createAdapter($transport);
        $operation = $this->createOperation(['prompt' => '提交任务']);
        $operation->setProviderPayload([
            'model' => 'wan2.7-t2v',
            'input' => ['prompt' => '提交任务'],
        ]);

        $taskId = $adapter->submit($operation, $this->createConfig());

        $this->assertSame('task-123', $taskId);
        $this->assertSame($operation->getProviderPayload(), $transport->submittedPayload);
    }

    public function testQueryMapsSucceededAndFailedStatuses(): void
    {
        $adapter = $this->createAdapter(new Wan27FakeDashScopeTransport(
            queryResponse: [
                'output' => [
                    'task_status' => 'SUCCEEDED',
                    'video_url' => 'https://localhost/result.mp4',
                ],
            ],
        ));

        $succeeded = $adapter->query($this->createOperation(['prompt' => '查询成功']), $this->createConfig(), 'task-123');

        $this->assertSame('succeeded', $succeeded['status']);
        $this->assertSame('https://localhost/result.mp4', $succeeded['output']['video_url']);
        $this->assertSame('task-123', $succeeded['output']['provider_task_id']);
        $this->assertSame('https://localhost', $succeeded['output']['provider_base_url']);
        $this->assertNull($succeeded['error']);

        $adapter = $this->createAdapter(new Wan27FakeDashScopeTransport(
            queryResponse: [
                'output' => [
                    'task_status' => 'CANCELED',
                    'code' => 'Canceled',
                    'message' => 'task canceled',
                ],
            ],
        ));

        $failed = $adapter->query($this->createOperation(['prompt' => '查询失败']), $this->createConfig(), 'task-456');

        $this->assertSame('failed', $failed['status']);
        $this->assertSame([], $failed['output']);
        $this->assertSame('PROVIDER_FAILED', $failed['error']['code']);
        $this->assertSame('task canceled', $failed['error']['message']);
        $this->assertSame('Canceled', $failed['error']['provider_code']);
    }

    private function createAdapter(?DashScopeTransportInterface $transport = null): Wan27VideoAdapter
    {
        return new Wan27VideoAdapter(
            new Wan27GenerationCapabilityProvider(),
            $transport ?? new Wan27FakeDashScopeTransport()
        );
    }

    private function createOperation(array $rawRequest): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-wan27-1',
            endpoint: 'video:wan2.7',
            model: 'wan2.7',
            modelVersion: 'wan2.7',
            providerModelId: 'provider-model-dashscope',
            providerCode: 'DashScope',
            providerName: 'dashscope',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            videoId: 'video-1',
            rawRequest: $rawRequest,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createConfig(): QueueExecutorConfig
    {
        return new QueueExecutorConfig(
            'https://localhost',
            'secret',
            3,
            20,
            []
        );
    }
}

final class Wan27FakeDashScopeTransport implements DashScopeTransportInterface
{
    public array $submittedPayload = [];

    public function __construct(
        private array $submitResponse = [],
        private array $queryResponse = [],
    ) {
    }

    public function submitVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        $this->submittedPayload = $payload;

        return $this->submitResponse;
    }

    public function queryTask(QueueExecutorConfig $config, string $taskId, array $logContext = []): array
    {
        return $this->queryResponse;
    }
}
