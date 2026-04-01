<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Domain\SuperAgent\Entity\ValueObject;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use PHPUnit\Framework\TestCase;
use ValueError;

/**
 * @internal
 */
class TaskFileSourceTest extends TestCase
{
    public function testAiVideoGenerationMetadataIsAvailable(): void
    {
        $source = TaskFileSource::AI_VIDEO_GENERATION;

        $this->assertSame(7, $source->value);
        $this->assertSame('AI视频生成', $source->getName());
        $this->assertTrue($source->isAIGenerated());
    }

    public function testFromStrictValueSupportsAiGeneratedValues(): void
    {
        $this->assertSame(TaskFileSource::AI_IMAGE_GENERATION, TaskFileSource::fromStrictValue(5));
        $this->assertSame(TaskFileSource::AI_VIDEO_GENERATION, TaskFileSource::fromStrictValue('7'));
    }

    public function testFromStrictValueThrowsForInvalidValue(): void
    {
        $this->expectException(ValueError::class);

        TaskFileSource::fromStrictValue('invalid');
    }

    public function testFromValueFallsBackToDefaultForInvalidValue(): void
    {
        $this->assertSame(TaskFileSource::DEFAULT, TaskFileSource::fromValue('invalid'));
    }
}
