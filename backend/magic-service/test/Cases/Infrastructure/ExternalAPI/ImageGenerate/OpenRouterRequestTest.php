<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\OpenRouterRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\OpenRouterRequest
 */
class OpenRouterRequestTest extends TestCase
{
    public function testRequestExcludesReasoningByDefault(): void
    {
        $request = new OpenRouterRequest(
            'google/gemini-3.1-flash-image-preview',
            '小猫在喝水',
            [
                'aspect_ratio' => '3:4',
                'image_size' => '2K',
            ]
        );

        $payload = $request->toArray();

        $this->assertSame([
            'effort' => 'minimal',
            'exclude' => true,
        ], $payload['reasoning']);
    }
}
