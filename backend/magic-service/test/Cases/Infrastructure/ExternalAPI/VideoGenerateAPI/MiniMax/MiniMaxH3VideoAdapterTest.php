<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Adapter\MiniMaxH3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Capability\MiniMaxH3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\MiniMaxVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Transport\ApiKeyMiniMaxTransport;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Throwable;

/**
 * @internal
 */
class MiniMaxH3VideoAdapterTest extends TestCase
{
    private ?ContainerInterface $originalContainer = null;

    protected function setUp(): void
    {
        parent::setUp();

        if (ApplicationContext::hasContainer()) {
            $this->originalContainer = ApplicationContext::getContainer();
        }

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
                            return $this->trans($key, $replace, $locale);
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

    protected function tearDown(): void
    {
        if ($this->originalContainer instanceof ContainerInterface) {
            ApplicationContext::setContainer($this->originalContainer);
        }

        parent::tearDown();
    }

    public function testCapabilityAndPayloadForReferenceVideo(): void
    {
        $adapter = $this->createAdapter();

        self::assertTrue($adapter->supportsModel('MiniMax-H3', 'minimax-h3'));
        $capability = $adapter->resolveGenerationConfig('MiniMax-H3', 'minimax-h3')?->toArray();
        self::assertSame(['768p', '2k'], $capability['generation']['resolutions']);
        self::assertCount(12, $capability['generation']['sizes']);
        self::assertSame([
            'label' => '16:9',
            'value' => '1366x768',
            'width' => 1366,
            'height' => 768,
            'resolution' => '768p',
        ], $capability['generation']['sizes'][0]);
        self::assertSame([
            'label' => '21:9',
            'value' => '2688x1152',
            'width' => 2688,
            'height' => 1152,
            'resolution' => '2k',
        ], $capability['generation']['sizes'][11]);
        self::assertTrue($capability['generation']['supports_watermark']);
        self::assertTrue($capability['generation']['supports_generate_audio']);
        foreach ([
            'supports_seed',
            'supports_negative_prompt',
            'supports_person_generation',
            'supports_enhance_prompt',
            'supports_compression_quality',
            'supports_resize_mode',
            'supports_sample_count',
        ] as $unsupportedCapability) {
            self::assertArrayNotHasKey($unsupportedCapability, $capability['generation']);
        }
        self::assertSame(9, $capability['reference_images']['max_count']);
        self::assertSame(
            ['standard', 'image_reference', 'omni_reference', 'keyframe_guided'],
            array_keys($capability['input_modes']),
        );
        self::assertSame(['reference_images'], $capability['input_modes']['image_reference']['supported_fields']);
        self::assertSame(9, $capability['input_modes']['image_reference']['reference_images']['max_count']);
        self::assertSame(
            ['reference_images', 'reference_videos', 'reference_audios'],
            $capability['input_modes']['omni_reference']['supported_fields'],
        );
        self::assertSame(15, $capability['input_modes']['omni_reference']['max_count']);
        self::assertSame('reference_media', $capability['input_modes']['omni_reference']['variants'][0]['code']);
        self::assertSame(['start', 'end'], $capability['input_modes']['keyframe_guided']['frame_roles']);

        $operation = $this->operation([
            'prompt' => '让角色沿参考动作奔跑',
            'inputs' => [
                'reference_videos' => [['uri' => 'https://example.com/reference.mp4']],
                'reference_images' => [['uri' => 'https://example.com/character.png']],
            ],
            'generation' => [
                'resolution' => '2k',
                'duration_seconds' => 10,
                'aspect_ratio' => '16:9',
                'watermark' => true,
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);

        self::assertSame('MiniMax-H3', $payload['model']);
        self::assertSame('2K', $payload['resolution']);
        self::assertSame(10, $payload['duration']);
        self::assertTrue($payload['aigc_watermark']);
        self::assertSame('reference_image', $payload['content'][1]['role']);
        self::assertSame('reference_video', $payload['content'][2]['role']);
    }

    public function testFramesCannotBeCombinedWithReferenceMedia(): void
    {
        $this->expectException(Throwable::class);

        $this->createAdapter()->buildProviderPayload($this->operation([
            'prompt' => '生成视频',
            'inputs' => [
                'frames' => [['role' => 'start', 'uri' => 'https://example.com/start.png']],
                'reference_images' => [['uri' => 'https://example.com/reference.png']],
            ],
            'generation' => ['resolution' => '768p', 'duration_seconds' => 5, 'aspect_ratio' => '16:9'],
        ]));
    }

    public function testAdapterSupportsConnectivityTest(): void
    {
        $this->assertInstanceOf(VideoGenerationConnectivityTestableInterface::class, $this->createAdapter());
    }

    private function createAdapter(): MiniMaxH3VideoAdapter
    {
        return new MiniMaxH3VideoAdapter(
            new MiniMaxH3GenerationCapabilityProvider(),
            new ApiKeyMiniMaxTransport(new MiniMaxVideoClient($this->createMock(ClientFactory::class))),
        );
    }

    private function operation(array $rawRequest): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-minimax-h3',
            endpoint: 'video:minimax-h3',
            model: 'minimax-h3',
            modelVersion: 'MiniMax-H3',
            providerModelId: 'minimax-h3',
            providerCode: 'MiniMax',
            providerName: 'minimax',
            organizationCode: 'org',
            userId: 'user',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: $rawRequest,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
