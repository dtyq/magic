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
    public function testPrepareInputsConvertsBase64ImagesToDataUrls(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-base64',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '2121/videos',
            'inputs' => [
                'reference_images' => [[
                    'source_type' => 'base64',
                    'base64_data' => base64_encode('mock-image'),
                    'mime_type' => 'image/webp',
                ]],
                'frames' => [[
                    'role' => 'start',
                    'source_type' => 'base64',
                    'base64_data' => base64_encode('mock-frame'),
                    'mime_type' => 'image/jpeg',
                ]],
            ],
        ]);

        $inputs = DesignVideoInputPayloadPreparer::prepareInputs($dto);

        $this->assertSame('data:image/webp;base64,' . base64_encode('mock-image'), $inputs['reference_images'][0]['uri']);
        $this->assertSame('data:image/jpeg;base64,' . base64_encode('mock-frame'), $inputs['frames'][0]['uri']);
    }

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

    public function testPrepareInputsPreservesProviderAssetUris(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-provider-assets',
            'model_id' => 'doubao-seedance-2-0-260128',
            'prompt' => '人物面对镜头介绍产品',
            'file_dir' => '2121/videos',
            'inputs' => [
                'reference_images' => [[
                    'uri' => 'asset://avatar-image-001',
                    'type' => 'asset',
                ]],
                'reference_videos' => [[
                    'uri' => 'asset://avatar-video-001',
                ]],
                'reference_audios' => [[
                    'uri' => 'asset://avatar-audio-001',
                ]],
                'frames' => [[
                    'role' => 'start',
                    'uri' => 'asset://avatar-frame-001',
                ]],
            ],
        ]);

        $this->assertSame([
            'reference_images' => [[
                'uri' => 'asset://avatar-image-001',
                'type' => 'asset',
            ]],
            'reference_videos' => [[
                'uri' => 'asset://avatar-video-001',
            ]],
            'reference_audios' => [[
                'uri' => 'asset://avatar-audio-001',
            ]],
            'frames' => [[
                'role' => 'start',
                'uri' => 'asset://avatar-frame-001',
            ]],
        ], DesignVideoInputPayloadPreparer::prepareInputs($dto));
    }

    public function testPrepareInputsStillRejectsProviderAssetUriAsFileDirectory(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-invalid-file-dir',
            'model_id' => 'doubao-seedance-2-0-260128',
            'prompt' => '人物面对镜头介绍产品',
            'file_dir' => 'asset://not-a-directory',
        ]);

        $this->expectException(Throwable::class);

        DesignVideoInputPayloadPreparer::sanitizeDtoForCreate($dto);
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
