<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Design;

use App\Infrastructure\Design\DesignVideoPromptReferenceRewriter;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DesignVideoPromptReferenceRewriterTest extends TestCase
{
    public function testRewriteReplacesOriginalFileMentionsWithoutAddingPromptPreamble(): void
    {
        $rewriter = new DesignVideoPromptReferenceRewriter();

        $prompt = $rewriter->rewrite(
            '@素材A.mp3 配合 @素材A.mp4 和 @素材A.png',
            [
                'reference_images' => [
                    ['uri' => '/1212/images/素材A.png'],
                ],
                'reference_videos' => [
                    ['uri' => '/1212/videos/素材A.mp4'],
                ],
                'reference_audios' => [
                    ['uri' => '/1212/audios/素材A.mp3'],
                ],
            ],
        );

        $this->assertSame('@音频1 配合 @视频1 和 @图片1', $prompt);
    }

    public function testRewriteKeepsPromptUntouchedOutsideReferenceModes(): void
    {
        $rewriter = new DesignVideoPromptReferenceRewriter();

        $prompt = $rewriter->rewrite(
            '@素材A.png',
            [
                'reference_images' => [
                    ['uri' => '/1212/images/素材A.png'],
                ],
            ],
        );

        $this->assertSame('@素材A.png', $prompt);
    }
}
