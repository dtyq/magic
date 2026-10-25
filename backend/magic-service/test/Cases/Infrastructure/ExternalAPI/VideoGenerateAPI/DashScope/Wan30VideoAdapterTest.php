<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan30VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/** @internal */
final class Wan30VideoAdapterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        ApplicationContext::setContainer(new readonly class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === TranslatorInterface::class) {
                    return new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    };
                }
                return null;
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
    }

    public function testBuildsStandardPayloadWithConfirmedWan30Fields(): void
    {
        $operation = $this->operation([
            'prompt' => '城市日落',
            'generation' => [
                'resolution' => '1080p',
                'aspect_ratio' => '16:9',
                'duration_seconds' => 8,
                'generate_audio' => true,
                'enhance_prompt' => true,
                'seed' => 123,
                'watermark' => false,
            ],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame('wan3.0-video', $payload['model']);
        self::assertSame(['prompt' => '城市日落'], $payload['input']);
        self::assertSame([
            'resolution' => '1080P',
            'duration' => 8,
            'ratio' => '16:9',
            'prompt_extend' => true,
            'audio' => true,
            'seed' => 123,
            'watermark' => false,
        ], $payload['parameters']);
        self::assertContains('generation.generate_audio', $operation->getAcceptedParams());
    }

    public function testBuildsKeyframePayload(): void
    {
        $operation = $this->operation([
            'input_mode' => 'keyframe_guided',
            'prompt' => '从起点到终点',
            'inputs' => ['frames' => [
                ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                ['role' => 'end', 'uri' => 'https://example.com/end.png'],
            ]],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame([
            ['type' => 'first_frame', 'url' => 'https://example.com/start.png'],
            ['type' => 'last_frame', 'url' => 'https://example.com/end.png'],
        ], $payload['input']['media']);
    }

    public function testBuildsKeyframePayloadWithNormalizedRoleAliases(): void
    {
        $operation = $this->operation([
            'input_mode' => 'keyframe_guided',
            'inputs' => ['frames' => [
                ['role' => 'first', 'uri' => 'https://example.com/start.png'],
                ['role' => 'last', 'uri' => 'https://example.com/end.png'],
            ]],
        ]);

        self::assertCount(2, $this->adapter()->buildProviderPayload($operation)['input']['media']);
    }

    public function testBuildsImageReferencePayloadWithReferenceImageMedia(): void
    {
        $operation = $this->operation([
            'input_mode' => 'image_reference',
            'prompt' => '参考这张图生成视频',
            'inputs' => ['reference_images' => [['uri' => 'https://example.com/ref.png']]],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame([
            ['type' => 'reference_image', 'url' => 'https://example.com/ref.png'],
        ], $payload['input']['media']);
        self::assertContains('inputs.reference_images', $operation->getAcceptedParams());
        self::assertNotContains('inputs.frames.start', $operation->getAcceptedParams());
    }

    public function testBuildsOmniReferencePayloadWithTypedMedia(): void
    {
        $operation = $this->operation([
            'input_mode' => 'omni_reference',
            'prompt' => '融合图、视频和音频',
            'inputs' => [
                'reference_images' => [['uri' => 'https://example.com/ref.png']],
                'reference_videos' => [['uri' => 'https://example.com/ref.mp4', 'duration_seconds' => 5]],
                'reference_audios' => [['uri' => 'https://example.com/ref.mp3', 'duration_seconds' => 4]],
            ],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame([
            ['type' => 'reference_image', 'url' => 'https://example.com/ref.png'],
            ['type' => 'reference_video', 'url' => 'https://example.com/ref.mp4'],
            ['type' => 'reference_audio', 'url' => 'https://example.com/ref.mp3'],
        ], $payload['input']['media']);
    }

    public function testBuildsOmniReferencePayloadFromTextOnly(): void
    {
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'prompt' => '只用文字生成',
        ]));

        self::assertSame(['prompt' => '只用文字生成'], $payload['input']);
        self::assertArrayNotHasKey('media', $payload['input']);
    }

    public function testBuildsStandardPayloadFromTextOnly(): void
    {
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'standard',
            'prompt' => '只用文字生成视频',
        ]));

        self::assertSame(['prompt' => '只用文字生成视频'], $payload['input']);
        self::assertArrayNotHasKey('media', $payload['input']);
    }

    public function testBuildsVideoEditPayloadWithReferenceVideo(): void
    {
        $operation = $this->operation([
            'input_mode' => 'video_edit',
            'prompt' => '转换为黏土风格',
            'inputs' => ['reference_videos' => [['uri' => 'https://example.com/source.mp4']]],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame([
            ['type' => 'reference_video', 'url' => 'https://example.com/source.mp4'],
        ], $payload['input']['media']);
        self::assertSame(-1, $payload['parameters']['duration']);
    }

    public function testBuildsVideoEditPayloadWithBase64ReferenceVideo(): void
    {
        $encoded = base64_encode('video-bytes');
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'video_edit',
            'inputs' => ['reference_videos' => [[
                'base64' => $encoded,
                'mime_type' => 'video/mp4',
            ]]],
        ]));

        self::assertSame('data:video/mp4;base64,' . $encoded, $payload['input']['media'][0]['url']);
    }

    public function testRejectsMalformedBase64ReferenceVideo(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'video_edit',
            'inputs' => ['reference_videos' => [[
                'base64' => 'bad@@@',
                'mime_type' => 'video/mp4',
            ]]],
        ]));
    }

    public function testReadsOmniImageLimitFromCapabilityMetadata(): void
    {
        $provider = new readonly class extends Wan30GenerationCapabilityProvider {
            public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
            {
                $config = parent::resolveGenerationConfig($modelVersion, $modelId);
                if ($config === null) {
                    return null;
                }

                $data = $config->toArray();
                $data['input_modes']['omni_reference']['variants'][0]['limits']['count']['max'] = 1;
                return new VideoGenerationConfig($data);
            }
        };
        $operation = $this->operation([
            'input_mode' => 'omni_reference',
            'inputs' => ['reference_images' => [
                ['uri' => 'https://example.com/ref-1.png'],
                ['uri' => 'https://example.com/ref-2.png'],
            ]],
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->adapter(capabilityProvider: $provider)->buildProviderPayload($operation);
    }

    public function testRejectsInvalidResolutionDurationAndMediaCombination(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'standard',
            'inputs' => ['reference_images' => [['uri' => 'https://example.com/ref.png']]],
            'generation' => ['resolution' => '4k', 'duration_seconds' => 31],
        ]));
    }

    public function testRejectsOmniVideoTotalDurationOverLimit(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'inputs' => ['reference_videos' => [['uri' => 'https://example.com/video', 'duration_seconds' => 16]]],
        ]));
    }

    public function testRejectsOmniAudioTotalDurationOverLimit(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'inputs' => ['reference_audios' => [['uri' => 'https://example.com/audio', 'duration_seconds' => 16]]],
        ]));
    }

    public function testRejectsMalformedAndDuplicateMediaEntries(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'inputs' => ['reference_images' => [
                ['uri' => 'https://example.com/ref.png'],
                ['uri' => 'https://example.com/ref.png'],
            ]],
        ]));
    }

    public function testRejectsPresentNonArrayMediaInput(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'inputs' => ['reference_images' => 'https://example.com/ref.png'],
        ]));
    }

    public function testRejectsUnknownKeyframeRole(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'keyframe_guided',
            'inputs' => ['frames' => [
                ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                ['role' => 'middle', 'uri' => 'https://example.com/middle.png'],
            ]],
        ]));
    }

    public function testRejectsConflictingWanModelIdentifiers(): void
    {
        $operation = $this->operation([], 'wan3.0-video-prime');

        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($operation);
    }

    public function testRejectsUnknownInputMode(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation(['input_mode' => 'unknown']));
    }

    public function testGenerateAudioCanBeDisabledAndResolveAudioOutputFollowsRequest(): void
    {
        $operation = $this->operation(['generation' => ['generate_audio' => false]]);
        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertFalse($payload['parameters']['audio']);
        self::assertFalse($this->adapter()->resolveHasAudioOutput('wan3.0-video', '', $operation->getRawRequest()));
        self::assertTrue($this->adapter()->resolveHasAudioOutput('wan3.0-video', 'provider-model-dashscope', ['generation' => ['generate_audio' => true]]));
    }

    public function testResolveHasAudioOutputSafelyRejectsConflictingWanModelIdentifiers(): void
    {
        self::assertFalse($this->adapter()->resolveHasAudioOutput('wan3.0-video', 'wan3.0-video-prime', []));
    }

    public function testPrefersValidModelVersionOverNumericProviderModelId(): void
    {
        self::assertTrue($this->adapter()->supportsModel('wan3.0-video', '12345'));
    }

    public function testSubmitReturnsTaskIdAndQueryMapsSuccessAndFailure(): void
    {
        $transport = new Wan30FakeDashScopeTransport(['output' => ['task_id' => 'task-30']]);
        $adapter = $this->adapter($transport);
        $operation = $this->operation([]);
        $operation->setProviderPayload(['model' => 'wan3.0-video', 'input' => ['prompt' => 'x']]);

        self::assertSame('task-30', $adapter->submit($operation, $this->config()));

        $transport->queryResponse = ['output' => [
            'task_status' => 'SUCCEEDED',
            'video_url' => 'https://example.com/result.mp4',
        ]];
        $success = $adapter->query($operation, $this->config(), 'task-30');
        self::assertSame('succeeded', $success['status']);
        self::assertSame('https://example.com/result.mp4', $success['output']['video_url']);

        $transport->queryResponse = ['output' => [
            'task_status' => 'FAILED',
            'code' => 'InvalidParameter',
            'message' => 'bad prompt',
        ]];
        $failure = $adapter->query($operation, $this->config(), 'task-30');
        self::assertSame('failed', $failure['status']);
        self::assertSame((string) VideoGenerateErrorCode::INVALID_PARAMETER->value, $failure['error']['code']);
        self::assertSame('InvalidParameter', $failure['error']['provider_code']);

        $transport->queryResponse = ['output' => ['task_status' => 'FAILED', 'task_status_msg' => 'provider failed']];
        $unknownFailure = $adapter->query($operation, $this->config(), 'task-30');
        self::assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $unknownFailure['error']['code']);

        $transport->queryResponse = ['output' => ['task_status' => 'SUCCEEDED']];
        $missingOutput = $adapter->query($operation, $this->config(), 'task-30');
        self::assertSame('failed', $missingOutput['status']);
        self::assertSame((string) VideoGenerateErrorCode::MISSING_VIDEO_DATA->value, $missingOutput['error']['code']);
    }

    public function testConnectivityChecksSubmittedTaskByQueryingIt(): void
    {
        $transport = new Wan30FakeDashScopeTransport(
            ['output' => ['task_id' => 'connectivity-task']],
            ['output' => [
                'task_status' => 'FAILED',
                'code' => 'InvalidParameter',
                'message' => 'duration must be -1 or in [2,30]',
            ]],
        );

        self::assertTrue($this->adapter($transport)->testConnection($this->config(), 'wan3.0-video'));
        self::assertSame('connectivity-task', $transport->queriedTaskId);
    }

    public function testConnectivityRetriesQueryUntilProviderRejectsInvalidDuration(): void
    {
        $transport = new Wan30FakeDashScopeTransport(
            ['output' => ['task_id' => 'connectivity-task']],
            ['output' => ['task_status' => 'RUNNING']],
        );
        $transport->queryResponses = [
            ['output' => ['task_status' => 'RUNNING']],
            ['output' => [
                'code' => 'InvalidParameter',
                'message' => 'duration must be -1 or in [2,30]',
            ]],
        ];

        self::assertTrue($this->adapter($transport)->testConnection($this->config(), 'wan3.0-video'));
        self::assertSame(2, $transport->queryCount);
    }

    public function testIsSelfContained(): void
    {
        self::assertFalse(get_parent_class(Wan30VideoAdapter::class));
    }

    private function adapter(?DashScopeTransportInterface $transport = null, ?Wan30GenerationCapabilityProvider $capabilityProvider = null): Wan30VideoAdapter
    {
        return new Wan30VideoAdapter($capabilityProvider ?? new Wan30GenerationCapabilityProvider(), $transport ?? new Wan30FakeDashScopeTransport());
    }

    private function operation(array $request, string $providerModelId = 'provider-model-dashscope'): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-wan30-1',
            endpoint: 'video:wan3.0',
            model: 'wan3.0-video',
            modelVersion: 'wan3.0-video',
            providerModelId: $providerModelId,
            providerCode: 'DashScope',
            providerName: 'dashscope',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            videoId: 'video-1',
            rawRequest: $request,
        );
    }

    private function config(): QueueExecutorConfig
    {
        return new QueueExecutorConfig('https://localhost', 'secret', 3, 20, []);
    }
}

final class Wan30FakeDashScopeTransport implements DashScopeTransportInterface
{
    public array $queryResponse = [];

    public array $queryResponses = [];

    public int $queryCount = 0;

    public ?string $queriedTaskId = null;

    public function __construct(private array $submitResponse = [], array $queryResponse = [])
    {
        $this->queryResponse = $queryResponse;
    }

    public function submitVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        return $this->submitResponse;
    }

    public function queryTask(QueueExecutorConfig $config, string $taskId, array $logContext = []): array
    {
        ++$this->queryCount;
        $this->queriedTaskId = $taskId;
        if ($this->queryResponses !== []) {
            return array_shift($this->queryResponses);
        }
        return $this->queryResponse;
    }
}
