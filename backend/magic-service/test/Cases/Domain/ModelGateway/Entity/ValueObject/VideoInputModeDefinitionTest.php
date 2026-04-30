<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use App\Domain\ModelGateway\Entity\ValueObject\VideoTaskType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoInputModeDefinitionTest extends TestCase
{
    public function testStandardDefinitionUsesGenerateTaskByDefault(): void
    {
        $definition = VideoInputModeDefinition::standard('standard')->toArray();

        $this->assertSame('standard', $definition['description']);
        $this->assertSame([], $definition['supported_fields']);
        $this->assertSame(VideoTaskType::Generate->value, $definition['task']);
    }

    public function testImageReferenceDefinitionIncludesReferenceImageConfig(): void
    {
        $definition = VideoInputModeDefinition::imageReference(
            description: 'image_reference',
            maxCount: 7,
            referenceTypes: ['asset', 'style'],
            styleSupported: true,
        )->toArray();

        $this->assertSame('image_reference', $definition['description']);
        $this->assertSame(['reference_images'], $definition['supported_fields']);
        $this->assertSame(VideoTaskType::Generate->value, $definition['task']);
        $this->assertSame([
            'max_count' => 7,
            'reference_types' => ['asset', 'style'],
            'style_supported' => true,
        ], $definition['reference_images']);
    }

    public function testOmniReferenceDefinitionIncludesMaxCountAndSupportedFields(): void
    {
        $definition = VideoInputModeDefinition::omniReference(
            description: 'omni_reference',
            supportedFields: ['reference_images', 'reference_videos'],
            maxCount: 12,
        )->toArray();

        $this->assertSame('omni_reference', $definition['description']);
        $this->assertSame(['reference_images', 'reference_videos'], $definition['supported_fields']);
        $this->assertSame(12, $definition['max_count']);
        $this->assertSame(VideoTaskType::Generate->value, $definition['task']);
    }

    public function testVideoEditDefinitionUsesEditTask(): void
    {
        $definition = VideoInputModeDefinition::videoEdit(
            description: 'video_edit',
            maxCount: 1,
        )->toArray();

        $this->assertSame('video_edit', $definition['description']);
        $this->assertSame(['reference_videos'], $definition['supported_fields']);
        $this->assertSame(1, $definition['max_count']);
        $this->assertSame(VideoTaskType::Edit->value, $definition['task']);
    }

    public function testKeyframeGuidedDefinitionIncludesFrameRoles(): void
    {
        $definition = VideoInputModeDefinition::keyframeGuided(
            description: 'keyframe_guided',
            frameRoles: ['start', 'end'],
        )->toArray();

        $this->assertSame('keyframe_guided', $definition['description']);
        $this->assertSame(['frames'], $definition['supported_fields']);
        $this->assertSame(['start', 'end'], $definition['frame_roles']);
        $this->assertSame(VideoTaskType::Generate->value, $definition['task']);
    }
}
