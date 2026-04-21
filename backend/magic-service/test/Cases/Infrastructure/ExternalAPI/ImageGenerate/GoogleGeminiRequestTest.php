<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest
 */
class GoogleGeminiRequestTest extends TestCase
{
    public function testGenerationConfigUsesVertexImageConfigFieldNames(): void
    {
        $request = new GoogleGeminiRequest('1792', '2400', '小猫在喝水', '', 'gemini-3.1-flash-image-preview');
        $request->setRatio('3:4');
        $request->setResolutionPreset('2K');

        $generationConfig = $request->getGenerationConfig();

        $this->assertSame([
            'aspectRatio' => '3:4',
            'imageSize' => '2K',
        ], $generationConfig['imageConfig']);
        $this->assertArrayNotHasKey('aspect_ratio', $generationConfig['imageConfig']);
        $this->assertArrayNotHasKey('image_size', $generationConfig['imageConfig']);
    }

    public function testFlashImageUsesProviderDefaultThinkingAndExcludesThoughts(): void
    {
        $request = new GoogleGeminiRequest('1792', '2400', '小猫在喝水', '', 'gemini-3.1-flash-image-preview');

        $generationConfig = $request->getGenerationConfig();

        $this->assertSame([
            'includeThoughts' => false,
        ], $generationConfig['thinkingConfig']);
        $this->assertArrayNotHasKey('thinkingLevel', $generationConfig['thinkingConfig']);
    }

    public function testProImageUsesProviderDefaultThinkingAndExcludesThoughts(): void
    {
        $request = new GoogleGeminiRequest('1792', '2400', '小猫在喝水', '', 'gemini-3-pro-image-preview');

        $generationConfig = $request->getGenerationConfig();

        $this->assertSame([
            'includeThoughts' => false,
        ], $generationConfig['thinkingConfig']);
        $this->assertArrayNotHasKey('thinkingLevel', $generationConfig['thinkingConfig']);
    }

    public function testThinkingLevelFieldIsNotExposed(): void
    {
        $request = new GoogleGeminiRequest('1792', '2400', '小猫在喝水', '', 'gemini-3.1-flash-image-preview');

        $this->assertFalse(method_exists($request, 'getThinkingLevel'));
        $this->assertFalse(method_exists($request, 'setThinkingLevel'));
    }
}
