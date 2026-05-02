<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingV3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingV3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class KelingV3VideoAdapterTest extends TestCase
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
                            return match ($key) {
                                'video.input_modes.standard' => '普通文生视频模式，不依赖任何参考素材。',
                                'video.input_modes.image_reference.single' => '上传 1 张参考图，搭配文字，生成高度匹配视频。示例：参考 @图片 1，生成动态视频。',
                                'video.input_modes.keyframe_guided.start_end' => '用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。',
                                default => $key,
                            };
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

    public function testResolveGenerationConfigExposesV3Defaults(): void
    {
        $adapter = $this->createAdapter();

        $config = $adapter->resolveGenerationConfig('YGNqszpCuuWLpyUt', 'keling-3.0-video');

        $this->assertNotNull($config);
        $data = $config->toArray();
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $data['supported_inputs']);
        $this->assertSame(['720p', '1080p', '4k'], $data['generation']['resolutions']);
        $this->assertCount(9, $data['generation']['sizes']);
        $this->assertSame([
            'label' => '16:9',
            'value' => '3840x2160',
            'width' => 3840,
            'height' => 2160,
            'resolution' => '4k',
        ], $data['generation']['sizes'][6]);
        $this->assertSame(['standard', 'image_reference', 'keyframe_guided'], array_keys($data['input_modes']));
    }

    public function testBuildProviderPayloadMapsV3InputsAndMode(): void
    {
        $adapter = $this->createAdapter();
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-v3-1',
            endpoint: 'video:keling-3.0-video',
            model: 'keling-3.0-video',
            modelVersion: 'YGNqszpCuuWLpyUt',
            providerModelId: 'provider-model-keling-v3',
            providerCode: 'Keling',
            providerName: 'keling',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => '让 {{image_1}} 动起来',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://localhost/start.png'],
                        ['role' => 'end', 'uri' => 'https://localhost/end.png'],
                    ],
                ],
                'generation' => [
                    'resolution' => '1080p',
                    'aspect_ratio' => '9:16',
                    'duration_seconds' => 10,
                    'negative_prompt' => 'no blur',
                    'generate_audio' => true,
                    'watermark' => false,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('kling-v3', $payload['model_name']);
        $this->assertSame('让 <<<image_1>>> 动起来', $payload['prompt']);
        $this->assertSame('https://localhost/start.png', $payload['image']);
        $this->assertSame('https://localhost/end.png', $payload['image_tail']);
        $this->assertSame('pro', $payload['mode']);
        $this->assertSame('9:16', $payload['aspect_ratio']);
        $this->assertSame('10', $payload['duration']);
        $this->assertSame('no blur', $payload['negative_prompt']);
        $this->assertSame('on', $payload['sound']);
        $this->assertSame(['enabled' => false], $payload['watermark_info']);

        $operation->setRawRequest([
            'prompt' => '让 {{image_1}} 动起来',
            'inputs' => [],
            'generation' => [
                'resolution' => '4k',
            ],
        ]);

        $payload = $adapter->buildProviderPayload($operation);
        $this->assertSame('4k', $payload['mode']);
    }

    private function createAdapter(): KelingV3VideoAdapter
    {
        return new KelingV3VideoAdapter(
            new KelingV3GenerationCapabilityProvider(),
            new KelingTransportFactory(
                new ApiKeyKelingTransport(
                    new KelingVideoClient($this->createMock(ClientFactory::class))
                )
            )
        );
    }
}
