<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/** @internal */
final class Wan30GenerationCapabilityProviderTest extends TestCase
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

    public function testSupportsFormalAndPrimeModelsWithCaseNormalization(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();

        self::assertTrue($provider->supportsModel('', 'wan3.0-video'));
        self::assertTrue($provider->supportsModel('WAN3.0-VIDEO', ''));
        self::assertTrue($provider->supportsModel('', ' Wan3.0-Video-Prime '));
        self::assertSame('wan3.0-video', $provider->resolveProviderModelName('', 'WAN3.0-VIDEO'));
        self::assertSame('wan3.0-video-prime', $provider->resolveProviderModelName('wan3.0-video-prime', ''));
    }

    public function testRejectsUnknownModels(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();

        self::assertFalse($provider->supportsModel('wan3.1-video', 'wan3.1-video'));
        self::assertFalse($provider->supportsModel('wan3.0-video', 'unknown'));
        self::assertFalse($provider->supportsModel('wan3.0-video', 'wan3.0-video-prime'));
        self::assertNull($provider->resolveGenerationConfig('', 'unknown'));
    }

    public function testRejectsUnknownOrConflictingProviderModelNames(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();

        $this->expectException(InvalidArgumentException::class);
        $provider->resolveProviderModelName('wan3.0-video', 'wan3.0-video-prime');
    }

    public function testResolveProviderModelNameRejectsUnknownIdentifiers(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();

        $this->expectException(InvalidArgumentException::class);
        $provider->resolveProviderModelName('', 'unknown');
    }

    public function testExposesConfirmedGenerationLimitsAndAudio(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();
        $config = $provider->resolveGenerationConfig('wan3.0-video', '');

        self::assertInstanceOf(VideoGenerationConfig::class, $config);
        $data = $config->toArray();
        self::assertSame(['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', 'reference_audios'], $data['supported_inputs']);
        self::assertSame(['16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'], $data['generation']['aspect_ratios']);
        self::assertSame(['min' => 2, 'max' => 30, 'step' => 1], $data['generation']['durations']);
        self::assertSame(['480p', '720p', '1080p'], $data['generation']['resolutions']);
        self::assertSame('720p', $data['generation']['default_resolution']);
        self::assertTrue($data['generation']['supports_seed']);
        self::assertTrue($data['generation']['supports_watermark']);
        self::assertTrue($data['generation']['supports_generate_audio']);
        self::assertTrue($data['generation']['supports_enhance_prompt']);
    }

    public function testExposesInputModesAndMediaLimits(): void
    {
        $provider = new Wan30GenerationCapabilityProvider();
        $config = $provider->resolveGenerationConfig('', 'wan3.0-video-prime');
        self::assertNotNull($config);

        $modes = $config->toArray()['input_modes'];
        self::assertArrayHasKey('standard', $modes);
        self::assertSame(1, $modes['image_reference']['reference_images']['max_count']);
        self::assertSame(['start', 'end'], $modes['keyframe_guided']['frame_roles']);
        self::assertSame(['start' => ['min' => 1, 'max' => 1], 'end' => ['max' => 1]], $modes['keyframe_guided']['limits']);
        self::assertSame(['first' => 'start', 'last' => 'end'], $modes['keyframe_guided']['role_aliases']);
        self::assertSame(['reference_images', 'reference_videos', 'reference_audios'], $modes['omni_reference']['supported_fields']);
        self::assertSame(20, $modes['omni_reference']['max_count']);
        self::assertSame('video.input_modes.omni_reference', $modes['omni_reference']['description']);
        self::assertSame([
            ['code' => 'reference_image', 'description' => 'video.input_modes.reference_image', 'limits' => ['count' => ['max' => 10]]],
            ['code' => 'reference_video', 'description' => 'video.input_modes.reference_video', 'limits' => ['count' => ['max' => 5], 'duration_seconds' => ['max' => 15], 'total_duration_seconds' => ['max' => 15]]],
            ['code' => 'reference_audio', 'description' => 'video.input_modes.reference_audio', 'limits' => ['count' => ['max' => 5], 'duration_seconds' => ['max' => 15], 'total_duration_seconds' => ['max' => 15]]],
        ], $modes['omni_reference']['variants']);
        self::assertSame(['reference_videos'], $modes['video_edit']['supported_fields']);
        self::assertSame(1, $modes['video_edit']['max_count']);

        $constraints = $config->toArray()['constraints'];
        self::assertSame(20, $constraints['reference_media']['max_count']);
        self::assertSame(30, $constraints['reference_media']['max_total_duration_seconds']);
        self::assertSame(1, $constraints['reference_media']['max_files']);
        self::assertSame(1, $constraints['reference_media']['max_public_urls']);
        self::assertTrue($constraints['reference_media']['file_and_public_url_mutually_exclusive']);
    }
}
