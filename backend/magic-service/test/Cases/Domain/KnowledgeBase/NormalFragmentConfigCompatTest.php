<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\ValueObject\NormalFragmentConfig;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class NormalFragmentConfigCompatTest extends TestCase
{
    public function testFromArraySupportsNullTextPreprocessRule(): void
    {
        $config = NormalFragmentConfig::fromArray([
            'segment_rule' => [
                'separator' => "\n\n",
                'chunk_size' => 50,
                'chunk_overlap' => 0,
            ],
            'text_preprocess_rule' => null,
        ]);

        $this->assertSame([], $config->getTextPreprocessRule());
        $this->assertSame("\n\n", $config->getSegmentRule()->getSeparator());
        $this->assertSame(50, $config->getSegmentRule()->getChunkSize());
        $this->assertSame(0, $config->getSegmentRule()->getChunkOverlap());
    }
}
