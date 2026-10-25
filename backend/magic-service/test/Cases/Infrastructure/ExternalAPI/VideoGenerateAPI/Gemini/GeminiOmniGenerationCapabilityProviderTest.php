<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/** @internal */
final class GeminiOmniGenerationCapabilityProviderTest extends TestCase
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

    public function testSupportsOnlyNormalizedGeminiOmniModelAndDeclaresConfirmedModes(): void
    {
        $provider = new GeminiOmniGenerationCapabilityProvider();

        self::assertTrue($provider->supportsModel(' GEMINI-OMNI-1.1-FLASH ', ''));
        self::assertTrue($provider->supportsModel('', 'gemini-omni-1.1-flash'));
        self::assertTrue($provider->supportsModel('Gemini-Omni-1.1-Flash', ' GEMINI-OMNI-1.1-FLASH '));
        self::assertFalse($provider->supportsModel('gemini-omni-1.1-flash', 'other'));
        self::assertFalse($provider->supportsModel('other', ''));

        $config = $provider->resolveGenerationConfig('gemini-omni-1.1-flash', '');
        self::assertNotNull($config);
        $data = $config->toArray();
        self::assertArrayHasKey('generation', $data);
        self::assertSame([3, 4, 5, 6, 7, 8, 9, 10], $data['generation']['durations']);
        self::assertSame(['360p', '720p', '1080p', '4k'], $data['generation']['resolutions']);
        self::assertTrue($data['generation']['supports_generate_audio']);
        self::assertContains('reference_audios', $data['supported_inputs']);
        foreach (['standard', 'image_reference', 'keyframe_guided', 'video_edit', 'omni_reference'] as $mode) {
            self::assertArrayHasKey($mode, $data['input_modes']);
        }
        self::assertContains('reference_audios', $data['input_modes']['omni_reference']['supported_fields']);
        self::assertSame('video.input_modes.omni_reference', $data['input_modes']['omni_reference']['description']);
    }
}
