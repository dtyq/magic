<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Design\Entity\Dto;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 */
class DesignVideoCreateDTOTest extends TestCase
{
    public function testInputsVideoIsRejected(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-6',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在跳舞',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'video' => ['uri' => '/2121/videos/source.mp4'],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->valid();
    }

    public function testReferenceInputsAndInputModeAreAccepted(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-1',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在唱歌跳舞',
            'file_dir' => '/2121/videos/',
            'input_mode' => 'omni_reference',
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/2121/images/a.jpg'],
                ],
                'reference_videos' => [
                    ['uri' => '/2121/videos/ref1.mp4'],
                ],
                'reference_audios' => [
                    ['uri' => '/2121/audios/ref1.wav'],
                ],
            ],
        ]);

        $dto->valid();

        $this->assertSame('omni_reference', $dto->getInputMode());
        $this->assertSame('/2121/images/a.jpg', $dto->getReferenceImages()[0]['uri']);
        $this->assertSame('/2121/videos/ref1.mp4', $dto->getReferenceVideos()[0]['uri']);
        $this->assertSame('/2121/audios/ref1.wav', $dto->getReferenceAudios()[0]['uri']);
        $this->assertSame([], $dto->getFrames());
    }

    public function testImageReferenceInputModeIsAcceptedWithReferenceImages(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-2',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'input_mode' => 'image_reference',
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/2121/images/reference.jpg'],
                ],
            ],
        ]);

        $dto->valid();

        $this->assertSame('image_reference', $dto->getInputMode());
        $this->assertSame('/2121/images/reference.jpg', $dto->getReferenceImages()[0]['uri']);
        $this->assertSame([], $dto->getReferenceVideos());
        $this->assertSame([], $dto->getReferenceAudios());
    }

    public function testInputModeCanBeInferredFromInputs(): void
    {
        $imageReferenceDto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-3',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/2121/images/reference.jpg'],
                ],
            ],
        ]);
        $imageReferenceDto->valid();

        $keyframeDto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-4',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在喝水',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'frames' => [
                    ['role' => 'start', 'uri' => '/2121/images/start.jpg'],
                ],
            ],
        ]);
        $keyframeDto->valid();

        $omniAudioDto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-5',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在唱歌',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'reference_audios' => [
                    ['uri' => '/2121/audios/reference.wav'],
                ],
            ],
        ]);
        $omniAudioDto->valid();

        $this->assertSame('image_reference', $imageReferenceDto->getInputMode());
        $this->assertSame('keyframe_guided', $keyframeDto->getInputMode());
        $this->assertSame('omni_reference', $omniAudioDto->getInputMode());
    }
}
