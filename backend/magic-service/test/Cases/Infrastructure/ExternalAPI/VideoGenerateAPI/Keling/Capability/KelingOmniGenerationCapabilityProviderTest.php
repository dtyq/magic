<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class KelingOmniGenerationCapabilityProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer($this->createMock(ContainerInterface::class));
        }
    }

    public function testResolveGenerationConfigExposesOmniDefaults(): void
    {
        $provider = new KelingOmniGenerationCapabilityProvider();

        $config = $provider->resolveGenerationConfig('kling-v3-omni', 'keling-video');

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $data = $config->toArray();
        $this->assertSame(['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', VideoInputMode::VideoEdit->value], $data['supported_inputs']);
        $this->assertSame(5, $data['generation']['default_duration_seconds']);
        $this->assertSame('720p', $data['generation']['default_resolution']);
        $this->assertSame(['720p', '1080p', '4k'], $data['generation']['resolutions']);
        $this->assertSame([
            ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
            ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
            ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
            ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
            ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
            ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
            ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
            ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
            ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
        ], $data['generation']['sizes']);
        $this->assertSame(
            ['standard', 'image_reference', 'omni_reference', VideoInputMode::VideoEdit->value, 'keyframe_guided'],
            array_keys($data['input_modes'])
        );
        $this->assertSame('generate', $data['input_modes']['omni_reference']['task']);
        $this->assertSame('edit', $data['input_modes'][VideoInputMode::VideoEdit->value]['task']);
    }

    public function testSupportsModelAcceptsConfiguredIdsOrVersions(): void
    {
        $provider = new KelingOmniGenerationCapabilityProvider();

        $this->assertTrue($provider->supportsModel('kling-v3-omni', 'kling-v3-omni'));
        $this->assertTrue($provider->supportsModel('kling-v3-omni', 'keling-3.0-video'));
        $this->assertTrue($provider->supportsModel('kling-v4-omni', 'keling-video'));
    }

    public function testResolveGenerationModeAndDurationUseCapabilityDefaults(): void
    {
        $provider = new KelingOmniGenerationCapabilityProvider();

        $this->assertSame('pro', $provider->resolveGenerationMode(['resolution' => '1080p']));
        $this->assertSame('4k', $provider->resolveGenerationMode(['resolution' => '4k']));
        $this->assertSame('std', $provider->resolveGenerationMode(['mode' => 'std']));
        $this->assertSame('4k', $provider->resolveGenerationMode(['mode' => '4k']));
        $this->assertSame('std', $provider->resolveGenerationMode([]));

        $this->assertSame('8', $provider->resolveDuration(['duration_seconds' => 8]));
        $this->assertSame('5', $provider->resolveDuration([]));
        $this->assertSame('5', $provider->resolveDuration(['duration_seconds' => 0]));
    }
}
