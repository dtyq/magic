<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\DashScopeVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan30VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiOmni1FlashVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingOmniVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Adapter\MiniMaxH3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Capability\MiniMaxH3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\MiniMaxVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Transport\ApiKeyMiniMaxTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance20MiniFastVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance20VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance25VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\VolcengineArkVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance20GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance20MiniFastGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance25GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use Hyperf\Guzzle\ClientFactory;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use Stringable;

/**
 * @internal
 */
class VideoGenerationConfigDomainServiceTest extends TestCase
{
    public function testResolveFeaturedSkipsUnconfiguredProviderAndKeepsPriorityConfig(): void
    {
        $service = $this->createService();

        $configs = $service->resolveFeatured([
            new VideoGenerationConfigCandidate('veo-3.1-fast-generate-preview', 'LCnVzCkkMnVulyrz', ProviderCode::Cloudsway),
            new VideoGenerationConfigCandidate('veo-3.1-fast-generate-preview', 'veo3.1_fast', ProviderCode::OpenAI),
        ]);

        $config = $configs['veo-3.1-fast-generate-preview'] ?? null;
        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        // 未接入的 provider 被跳过，直接采用首条可解析的 provider 原生配置。
        $this->assertSame(['16:9', '9:16'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame(['720p', '1080p', '4k'], $config->toArray()['generation']['resolutions']);
        $this->assertCount(5, $config->toArray()['generation']['sizes']);
    }

    /**
     * 同一逻辑 model_id 挂多条 provider_model 时，featured 必须与单条时结果完全一致：
     * 直接采用优先级最高的那条 provider 的原生配置，不做任何能力收缩。
     */
    public function testResolveFeaturedKeepsProviderConfigWhenModelHasDuplicatedCandidates(): void
    {
        $service = $this->createService();

        $configs = $service->resolveFeatured([
            new VideoGenerationConfigCandidate('gemini-omni-1.1-flash', 'gemini-omni-1.1-flash', ProviderCode::Gemini),
            new VideoGenerationConfigCandidate('gemini-omni-1.1-flash', 'gemini-omni-1.1-flash', ProviderCode::Gemini),
        ]);

        $config = $configs['gemini-omni-1.1-flash'] ?? null;
        $this->assertInstanceOf(VideoGenerationConfig::class, $config);

        $generation = $config->toArray()['generation'];
        $this->assertSame('range', $generation['duration_type']);
        // 关键回归点：多条候选不能被收缩成 {min:0, max:0, step:1}。
        $this->assertSame([3, 4, 5, 6, 7, 8, 9, 10], $generation['durations']);
        $this->assertSame(['360p', '720p', '1080p', '4k'], $generation['resolutions']);
        // 默认时长必须被完整带出，且落在可选区间内。
        $this->assertArrayHasKey('default_duration_seconds', $generation);
        $this->assertContains($generation['default_duration_seconds'], $generation['durations']);
    }

    public function testResolveRejectsUnsupportedProviderCode(): void
    {
        $service = $this->createService();

        $veoConfig = $service->resolve('veo3.1_fast', 'veo-3.1-fast-generate-preview', ProviderCode::OpenAI);

        $this->assertNull($veoConfig);
    }

    public function testResolveLogsAdapterFactoryFailure(): void
    {
        $logger = new class extends AbstractLogger {
            public array $records = [];

            public function log($level, string|Stringable $message, array $context = []): void
            {
                $this->records[] = [
                    'level' => $level,
                    'message' => (string) $message,
                    'context' => $context,
                ];
            }
        };
        $factory = new class implements VideoGenerationProviderAdapterFactoryInterface {
            public function createByProviderCode(ProviderCode $providerCode, ?string $modelVersion = null): VideoGenerationProviderAdapterInterface
            {
                throw new InvalidArgumentException('unsupported provider code');
            }
        };
        $service = new VideoGenerationConfigDomainService($factory, $logger);

        $config = $service->resolve('model-version-test', 'model-id-test', ProviderCode::OpenAI);

        $this->assertNull($config);
        $this->assertCount(1, $logger->records);
        $this->assertSame('warning', $logger->records[0]['level']);
        $this->assertSame('video generation adapter resolve failed', $logger->records[0]['message']);
        $this->assertSame('OpenAI', $logger->records[0]['context']['provider_code']);
        $this->assertSame('model-version-test', $logger->records[0]['context']['model_version']);
        $this->assertSame('model-id-test', $logger->records[0]['context']['model_id']);
        $this->assertSame('unsupported provider code', $logger->records[0]['context']['error']);
    }

    public function testResolveReturnsVolcengineArkSeedanceConfig(): void
    {
        $service = $this->createService();

        $config = $service->resolve(
            'doubao-seedance-2-0-260128',
            'doubao-seedance-2-0-260128',
            ProviderCode::VolcengineArk,
        );

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $this->assertContains('reference_videos', $config->toArray()['supported_inputs']);
        $this->assertContains('reference_audios', $config->toArray()['supported_inputs']);
        $this->assertNotContains('video', $config->toArray()['supported_inputs']);
        $this->assertContains(VideoInputMode::VideoEdit->value, $config->toArray()['supported_inputs']);
        $this->assertContains('video_extension', $config->toArray()['supported_inputs']);
        $this->assertContains('video_upscale', $config->toArray()['supported_inputs']);
        $this->assertSame(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], $config->toArray()['generation']['durations']);
        $this->assertSame(['480p', '720p', '1080p'], $config->toArray()['generation']['resolutions']);
        $this->assertSame([-1, 4294967295], $config->toArray()['generation']['seed_range']);
        $this->assertTrue($config->toArray()['generation']['supports_watermark']);
        $this->assertTrue($config->toArray()['generation']['supports_generate_audio']);
        $this->assertSame(9, $config->toArray()['reference_images']['max_count']);
        $this->assertArrayHasKey('input_modes', $config->toArray());
        $this->assertSame(['reference_images'], $config->toArray()['input_modes']['image_reference']['supported_fields']);
        $this->assertSame(9, $config->toArray()['input_modes']['image_reference']['reference_images']['max_count']);
        $this->assertStringContainsString('上传1~9 张参考图片', $config->toArray()['input_modes']['image_reference']['description']);
        $this->assertSame(['reference_images', 'reference_videos', 'reference_audios'], $config->toArray()['input_modes']['omni_reference']['supported_fields']);
        $this->assertSame(12, $config->toArray()['input_modes']['omni_reference']['max_count']);
        $this->assertStringContainsString('上传1~12 份图 / 视 / 音参考素材', $config->toArray()['input_modes']['omni_reference']['description']);
        $this->assertSame(['start', 'end'], $config->toArray()['input_modes']['keyframe_guided']['frame_roles']);
        $this->assertStringContainsString('首尾帧', $config->toArray()['input_modes']['keyframe_guided']['description']);
    }

    public function testResolveReturnsVolcengineArkSeedanceFastConfigWithout1080p(): void
    {
        $service = $this->createService();

        $config = $service->resolve(
            'doubao-seedance-2-0-fast-260128',
            'doubao-seedance-2-0-fast-260128',
            ProviderCode::VolcengineArk,
        );

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $this->assertSame(['480p', '720p'], $config->toArray()['generation']['resolutions']);
        $this->assertCount(12, $config->toArray()['generation']['sizes']);
    }

    public function testResolveBuildsModeDescriptionsFromConfig(): void
    {
        $service = $this->createService();

        $seedanceConfig = $service->resolve('rrpvTsUlqilBwMXg', 'seedance-1.5-pro', ProviderCode::Cloudsway);
        $veoConfig = $service->resolve('LCnVzCkkMnVulyrz', 'veo-3.1-generate-preview', ProviderCode::Cloudsway);

        $this->assertInstanceOf(VideoGenerationConfig::class, $seedanceConfig);
        $this->assertInstanceOf(VideoGenerationConfig::class, $veoConfig);
        $this->assertStringContainsString('只支持首帧', $seedanceConfig->toArray()['input_modes']['keyframe_guided']['description']);
        $this->assertStringContainsString('上传1~3 张参考图片', $veoConfig->toArray()['input_modes']['image_reference']['description']);
    }

    private function createService(): VideoGenerationConfigDomainService
    {
        return new VideoGenerationConfigDomainService(
            new VideoGenerateFactory(
                new CloudswayVideoAdapterRouter(
                    new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                ),
                new KelingVideoAdapterRouter(
                    new KelingOmniVideoAdapter(
                        new KelingOmniGenerationCapabilityProvider(),
                        new KelingTransportFactory(
                            new ApiKeyKelingTransport(
                                new KelingVideoClient($this->createMock(ClientFactory::class))
                            )
                        )
                    )
                ),
                $this->createVolcengineArkRouter($this->createMock(ClientFactory::class)),
                new DashScopeVideoAdapterRouter(new Wan30VideoAdapter(
                    new Wan30GenerationCapabilityProvider(),
                    $this->createMock(DashScopeTransportInterface::class),
                )),
                new MiniMaxH3VideoAdapter(
                    new MiniMaxH3GenerationCapabilityProvider(),
                    new ApiKeyMiniMaxTransport(new MiniMaxVideoClient($this->createMock(ClientFactory::class))),
                ),
                new GeminiVideoAdapterRouter(
                    new GeminiOmni1FlashVideoAdapter(
                        new GeminiOmniGenerationCapabilityProvider(),
                        $this->createMock(GeminiTransportInterface::class),
                    ),
                ),
            )
        );
    }

    private function createVolcengineArkRouter(ClientFactory $clientFactory): VolcengineArkVideoAdapterRouter
    {
        return new VolcengineArkVideoAdapterRouter(
            new Seedance20MiniFastVideoAdapter(
                new Seedance20MiniFastGenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
            new Seedance20VideoAdapter(
                new Seedance20GenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
            new Seedance25VideoAdapter(
                new Seedance25GenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
        );
    }
}
