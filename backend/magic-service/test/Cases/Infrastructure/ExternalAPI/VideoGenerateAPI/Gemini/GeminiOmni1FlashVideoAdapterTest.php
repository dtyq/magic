<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiOmni1FlashVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;
use Throwable;

/** @internal */
final class GeminiOmni1FlashVideoAdapterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        ApplicationContext::setContainer(new readonly class implements ContainerInterface {
            public function get(string $id): mixed
            {
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

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
    }

    public function testBuildsInteractionPayloadWithPartsAndVideoResponseFormat(): void
    {
        $start = base64_encode('start-frame');
        $end = base64_encode('end-frame');
        $operation = $this->operation([
            'input_mode' => 'keyframe_guided',
            'prompt' => 'camera moves forward',
            'inputs' => ['frames' => [
                ['role' => 'start', 'base64' => $start, 'mime_type' => 'image/jpeg'],
                ['role' => 'end', 'base64' => $end, 'mime_type' => 'image/jpeg'],
            ]],
            'generation' => ['aspect_ratio' => '16:9', 'resolution' => '1080p', 'duration_seconds' => 8],
        ]);

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame('gemini-omni-1.1-flash', $payload['model']);
        self::assertSame([
            ['type' => 'image', 'data' => $start, 'mime_type' => 'image/jpeg'],
            ['type' => 'image', 'data' => $end, 'mime_type' => 'image/jpeg'],
            ['type' => 'text', 'text' => 'camera moves forward'],
        ], $payload['input']);
        self::assertTrue($payload['background']);
        self::assertSame(['type' => 'video', 'delivery' => 'uri', 'aspect_ratio' => '16:9', 'resolution' => '1080p', 'duration' => '8s'], $payload['response_format']);
    }

    public function testBuildsOmniInteractionPayloadFromTextOnly(): void
    {
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'prompt' => 'generate a city sunset',
        ]));

        self::assertSame([
            ['type' => 'text', 'text' => 'generate a city sunset'],
        ], $payload['input']);
        self::assertSame(['video_config' => ['task' => 'reference_to_video']], $payload['generation_config']);
    }

    public function testBuildsOmniInteractionPayloadWithBase64AudioReference(): void
    {
        $encoded = base64_encode('audio-bytes');
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'omni_reference',
            'prompt' => 'use this audio',
            'inputs' => ['reference_audios' => [[
                'base64' => $encoded,
                'mime_type' => 'audio/mpeg',
            ]]],
        ]));

        self::assertSame([
            ['type' => 'audio', 'uri' => 'data:audio/mpeg;base64,' . $encoded],
            ['type' => 'text', 'text' => 'use this audio'],
        ], $payload['input']);
    }

    public function testBuildsInteractionPayloadWithBase64Frame(): void
    {
        $encoded = base64_encode('frame-bytes');
        $payload = $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'keyframe_guided',
            'inputs' => ['frames' => [[
                'role' => 'start',
                'base64' => $encoded,
                'mime_type' => 'image/jpeg',
            ]]],
        ]));

        self::assertSame('data:image/jpeg;base64,' . $encoded, $payload['input'][0]['uri']);
    }

    public function testRejectsMalformedBase64Frame(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->adapter()->buildProviderPayload($this->operation([
            'input_mode' => 'keyframe_guided',
            'inputs' => ['frames' => [[
                'role' => 'start',
                'base64' => 'bad@@@',
                'mime_type' => 'image/jpeg',
            ]]],
        ]));
    }

    public function testSubmitExtractsTopLevelInteractionIdAndQueryMapsStatusVideoAndUsage(): void
    {
        $transport = new GeminiFakeTransport(['id' => 'interaction-1']);
        $adapter = $this->adapter($transport);
        $operation = $this->operation([]);
        $operation->setProviderPayload(['model' => 'gemini-omni-1.1-flash']);

        self::assertSame('interaction-1', $adapter->submit($operation, $this->config()));

        $transport->queryResponse = [
            'id' => 'interaction-1', 'status' => 'completed',
            'steps' => [
                ['type' => 'user_input', 'content' => [['type' => 'video', 'data' => ['type' => 'base64']]]],
                ['type' => 'model_output', 'content' => [['type' => 'video', 'uri' => 'https://example.com/video.mp4']]],
            ],
            'usage' => ['completion_tokens' => 17, 'total_tokens' => 23],
        ];
        $transport->downloadResponse = ['bytes_base64_encoded' => base64_encode('provider-video'), 'mime_type' => 'video/mp4'];
        $result = $adapter->query($operation, $this->config(), 'interaction-1');
        self::assertSame('succeeded', $result['status']);
        self::assertSame('https://example.com/video.mp4', $result['output']['video_url']);
        self::assertSame(['completion_tokens' => 17, 'total_tokens' => 23], $result['provider_result']['usage']);
    }

    public function testNormalizesInlineVideoBase64ToProviderBytesContract(): void
    {
        $transport = new GeminiFakeTransport();
        $adapter = $this->adapter($transport);
        $encoded = base64_encode('inline-video-bytes');
        $transport->queryResponse = [
            'status' => 'completed',
            'steps' => [[
                'content' => [[
                    'type' => 'video',
                    'inlineData' => ['data' => $encoded, 'mimeType' => 'video/mp4'],
                ]],
            ]],
        ];

        $result = $adapter->query($this->operation([]), $this->config(), 'interaction-inline');

        self::assertSame('succeeded', $result['status']);
        self::assertSame($encoded, $result['provider_result']['response']['videos'][0]['bytesBase64Encoded']);
        self::assertSame('video/mp4', $result['provider_result']['response']['videos'][0]['mimeType']);
        self::assertArrayNotHasKey('video_url', $result['output']);
    }

    public function testDownloadsVideoUriThroughGeminiAuthenticatedTransport(): void
    {
        $transport = new GeminiFakeTransport();
        $transport->queryResponse = [
            'status' => 'completed',
            'steps' => [[
                'content' => [[
                    'type' => 'video',
                    'uri' => 'https://media.example/video.mp4',
                ]],
            ]],
        ];
        $transport->downloadResponse = ['bytes_base64_encoded' => base64_encode('remote-video'), 'mime_type' => 'video/mp4'];
        $adapter = $this->adapter($transport);

        $result = $adapter->query($this->operation([]), $this->config(), 'interaction-uri');

        self::assertSame('succeeded', $result['status']);
        self::assertSame('https://media.example/video.mp4', $transport->downloadedUris[0]);
        self::assertSame($transport->downloadResponse['bytes_base64_encoded'], $result['provider_result']['response']['videos'][0]['bytesBase64Encoded']);
        self::assertSame('video/mp4', $result['provider_result']['response']['videos'][0]['mimeType']);
        self::assertSame('https://media.example/video.mp4', $result['output']['video_url']);
    }

    public function testIgnoresImageAndTextUrisWhenNoVideoNodeIsPresent(): void
    {
        $transport = new GeminiFakeTransport();
        $transport->queryResponse = [
            'status' => 'completed',
            'steps' => [[
                'content' => [
                    ['type' => 'image', 'uri' => 'https://media.example/still.jpg'],
                    ['type' => 'text', 'uri' => 'https://media.example/not-video.txt'],
                ],
            ]],
        ];

        $result = $this->adapter($transport)->query($this->operation([]), $this->config(), 'interaction-no-video');

        self::assertSame('failed', $result['status']);
        self::assertSame((string) VideoGenerateErrorCode::MISSING_VIDEO_DATA->value, $result['error']['code']);
        self::assertSame([], $transport->downloadedUris);
    }

    public function testFindsVideoUriUnderResponseVideosWithoutExplicitType(): void
    {
        $transport = new GeminiFakeTransport();
        $transport->queryResponse = [
            'status' => 'completed',
            'response' => [
                'videos' => [['uri' => 'https://media.example/video.mp4']],
            ],
        ];
        $transport->downloadResponse = ['bytes_base64_encoded' => base64_encode('video'), 'mime_type' => 'video/mp4'];

        $result = $this->adapter($transport)->query($this->operation([]), $this->config(), 'interaction-response-videos');

        self::assertSame('succeeded', $result['status']);
        self::assertSame(['https://media.example/video.mp4'], $transport->downloadedUris);
    }

    public function testNormalizesOutputVideoDataWithoutType(): void
    {
        $transport = new GeminiFakeTransport();
        $encoded = base64_encode('output-video-bytes');
        $transport->queryResponse = [
            'status' => 'completed',
            'output_video' => ['data' => $encoded, 'mime_type' => 'video/webm'],
        ];

        $result = $this->adapter($transport)->query($this->operation([]), $this->config(), 'interaction-output-video');

        self::assertSame('succeeded', $result['status']);
        self::assertSame($encoded, $result['provider_result']['response']['videos'][0]['bytesBase64Encoded']);
        self::assertSame('video/webm', $result['provider_result']['response']['videos'][0]['mimeType']);
    }

    public function testFailedAndUnknownInteractionStatesUseSafeMappedError(): void
    {
        $transport = new GeminiFakeTransport(['id' => 'interaction-1']);
        $adapter = $this->adapter($transport);
        $operation = $this->operation([]);
        foreach (['queued', 'in_progress'] as $status) {
            $transport->queryResponse = ['status' => $status];
            self::assertSame('processing', $adapter->query($operation, $this->config(), 'interaction-1')['status']);
        }
        foreach (['cancelled', 'expired'] as $status) {
            $transport->queryResponse = ['status' => $status, 'error' => ['code' => 'INVALID_ARGUMENT', 'message' => 'secret']];
            $error = $adapter->query($operation, $this->config(), 'interaction-1')['error'];
            self::assertSame('failed', $adapter->query($operation, $this->config(), 'interaction-1')['status']);
            self::assertSame((string) VideoGenerateErrorCode::INVALID_PARAMETER->value, $error['code']);
            self::assertStringNotContainsString('secret', $error['message']);
        }
    }

    public function testRouterSelectsAdapterAndRejectsUnknownModel(): void
    {
        $adapter = $this->adapter();
        $router = new GeminiVideoAdapterRouter($adapter);
        self::assertTrue($router->supportsModel(' GEMINI-OMNI-1.1-FLASH ', ''));
        $this->expectException(RuntimeException::class);
        $router->buildProviderPayload($this->operation([], 'unknown'));
    }

    public function testRouterSupportsConnectivityTest(): void
    {
        $transport = new GeminiFakeTransport();
        $transport->submitException = new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'mapped error', new RequestException(
            'provider request failed',
            new Request('POST', 'https://gemini.example/v1/interactions'),
            new Response(400, [], 'Video response format duration must be positive'),
        ));
        $router = new GeminiVideoAdapterRouter($this->adapter($transport));

        self::assertInstanceOf(VideoGenerationConnectivityTestableInterface::class, $router);
        self::assertTrue($router->testConnection($this->config(), 'gemini-omni-1.1-flash'));
    }

    public function testPrefersValidModelVersionOverNumericProviderModelId(): void
    {
        $operation = $this->operation([], 'gemini-omni-1.1-flash', '12345');

        $payload = $this->adapter()->buildProviderPayload($operation);

        self::assertSame('gemini-omni-1.1-flash', $payload['model']);
    }

    public function testGeminiAdvertisesAudioOutput(): void
    {
        self::assertTrue($this->adapter()->resolveHasAudioOutput('gemini-omni-1.1-flash', '', [
            'generation' => ['generate_audio' => true],
        ]));
    }

    private function adapter(?GeminiTransportInterface $transport = null): GeminiOmni1FlashVideoAdapter
    {
        return new GeminiOmni1FlashVideoAdapter(new GeminiOmniGenerationCapabilityProvider(), $transport ?? new GeminiFakeTransport());
    }

    private function operation(array $request, string $model = 'gemini-omni-1.1-flash', string $providerModelId = ''): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity('op-gemini-1', 'video:gemini', $model, $model, $providerModelId, 'Gemini', 'gemini', 'org', 'user', VideoOperationStatus::QUEUED, 1, rawRequest: $request);
    }

    private function config(): QueueExecutorConfig
    {
        return new QueueExecutorConfig('https://gemini.example/v1', 'secret', 3, 20, []);
    }
}

final class GeminiFakeTransport implements GeminiTransportInterface
{
    public array $queryResponse = [];

    public array $downloadResponse = [];

    /** @var list<string> */
    public array $downloadedUris = [];

    public ?Throwable $submitException = null;

    public function __construct(private array $submitResponse = ['id' => 'interaction-1'])
    {
    }

    public function createInteraction(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        if ($this->submitException !== null) {
            throw $this->submitException;
        }

        return $this->submitResponse;
    }

    public function getInteraction(QueueExecutorConfig $config, string $interactionId, array $logContext = []): array
    {
        return $this->queryResponse;
    }

    public function downloadMedia(QueueExecutorConfig $config, string $uri, array $logContext = []): array
    {
        $this->downloadedUris[] = $uri;
        return $this->downloadResponse;
    }
}
