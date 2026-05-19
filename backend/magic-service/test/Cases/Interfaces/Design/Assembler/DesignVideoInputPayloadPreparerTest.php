<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Design\Assembler;

use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Factory\DesignVideoInputPayloadPreparer;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 */
class DesignVideoInputPayloadPreparerTest extends TestCase
{
    public function testPrepareInputsNormalizesAllWorkspacePaths(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-1',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '2121/videos',
            'inputs' => [
                'mask' => ['uri' => '2121/masks/mask.png'],
                'reference_images' => [
                    ['uri' => '2121/images/a.jpg', 'type' => 'style'],
                ],
                'reference_videos' => [
                    ['uri' => '2121/videos/ref.mp4'],
                ],
                'reference_audios' => [
                    ['uri' => '2121/audios/ref.wav'],
                ],
                'frames' => [
                    ['role' => 'start', 'uri' => '2121/images/start.jpg'],
                ],
            ],
        ]);

        $this->assertSame([
            'mask' => ['uri' => '/2121/masks/mask.png'],
            'reference_images' => [
                ['uri' => '/2121/images/a.jpg', 'type' => 'style'],
            ],
            'reference_videos' => [
                ['uri' => '/2121/videos/ref.mp4'],
            ],
            'reference_audios' => [
                ['uri' => '/2121/audios/ref.wav'],
            ],
            'frames' => [
                ['role' => 'start', 'uri' => '/2121/images/start.jpg'],
            ],
        ], DesignVideoInputPayloadPreparer::prepareInputs($dto));
    }

    public function testPrepareInputsRejectsMissingReferenceVideoUri(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-2',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '2121/videos',
            'inputs' => [
                'reference_videos' => [
                    [],
                ],
            ],
        ]);

        $this->expectException(Throwable::class);

        DesignVideoInputPayloadPreparer::prepareInputs($dto);
    }

    public function testSanitizeDtoForCreateNormalizesOutputDirAndInputs(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-3',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '2121/videos',
            'inputs' => [
                'reference_images' => [
                    ['uri' => '2121/images/a.jpg'],
                ],
            ],
        ]);

        DesignVideoInputPayloadPreparer::sanitizeDtoForCreate($dto);

        $this->assertSame('/2121/videos', $dto->getFileDir());
        $this->assertSame('/2121/images/a.jpg', $dto->getReferenceImages()[0]['uri']);
    }
}
