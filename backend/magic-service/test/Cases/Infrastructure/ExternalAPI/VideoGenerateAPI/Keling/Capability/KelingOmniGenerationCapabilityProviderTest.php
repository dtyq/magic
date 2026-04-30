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
        $this->assertSame('std', $provider->resolveGenerationMode(['mode' => 'std']));
        $this->assertSame('std', $provider->resolveGenerationMode([]));

        $this->assertSame('8', $provider->resolveDuration(['duration_seconds' => 8]));
        $this->assertSame('5', $provider->resolveDuration([]));
        $this->assertSame('5', $provider->resolveDuration(['duration_seconds' => 0]));
    }
}
