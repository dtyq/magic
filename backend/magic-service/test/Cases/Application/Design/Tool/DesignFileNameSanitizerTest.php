<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Tool;

use App\Application\Design\Tool\DesignFileNameSanitizer;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class DesignFileNameSanitizerTest extends TestCase
{
    public function testSanitizeRemovesReferenceTokensButKeepsNormalBrackets(): void
    {
        $this->assertSame(
            '海报_第[1]章',
            DesignFileNameSanitizer::sanitize('[图片1]_海报_第[1]章'),
        );
    }

    public function testSanitizeRemovesCanonicalAndEnglishReferenceTokens(): void
    {
        $this->assertSame(
            '城市夜景',
            DesignFileNameSanitizer::sanitize('{{image_1}} [video2] @音频3 城市夜景'),
        );
    }

    public function testSanitizePromptRemovesReferenceTokensBeforeFilenameAgentCall(): void
    {
        $this->assertSame(
            '参考 生成海报',
            DesignFileNameSanitizer::sanitizePrompt('参考[图片1]生成海报'),
        );
    }

    public function testSanitizeReturnsEmptyWhenOnlyReferenceTokenRemains(): void
    {
        $this->assertSame('', DesignFileNameSanitizer::sanitize('[视频1]'));
    }
}
