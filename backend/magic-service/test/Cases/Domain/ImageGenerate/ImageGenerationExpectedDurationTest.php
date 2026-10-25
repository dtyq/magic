<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ImageGenerate;

use App\Domain\ImageGenerate\ValueObject\ImageGenerationExpectedDuration;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageGenerationExpectedDurationTest extends TestCase
{
    public function testResolveSecondsUsesResolutionAndSizeFallback(): void
    {
        $cases = [
            ['1K', null, 45],
            ['2k', null, 70],
            ['4K', null, 100],
            [null, '1024x1024', 45],
            [null, '2048x2048', 70],
            [null, '4096x4096', 100],
            [null, null, 45],
        ];

        foreach ($cases as [$resolution, $size, $expectedDurationSeconds]) {
            $this->assertSame(
                $expectedDurationSeconds,
                ImageGenerationExpectedDuration::resolveSeconds($resolution, $size),
                json_encode(compact('resolution', 'size'), JSON_UNESCAPED_UNICODE)
            );
        }
    }
}
