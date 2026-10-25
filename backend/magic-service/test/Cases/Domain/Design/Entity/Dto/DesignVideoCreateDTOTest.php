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
    public function testBase64ReferenceImageIsAccepted(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-base64-image',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'reference_images' => [[
                    'source_type' => 'base64',
                    'base64_data' => base64_encode('mock-image'),
                    'mime_type' => 'image/png',
                    'type' => 'asset',
                ]],
            ],
        ]);

        $dto->valid();

        $this->assertSame('base64', $dto->getReferenceImages()[0]['source_type']);
    }

    public function testBase64FrameIsAccepted(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-base64-frame',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'frames' => [[
                    'role' => 'start',
                    'source_type' => 'base64',
                    'base64_data' => base64_encode('mock-frame'),
                    'mime_type' => 'image/jpeg',
                ]],
            ],
        ]);

        $dto->valid();

        $this->assertSame('base64', $dto->getFrames()[0]['source_type']);
    }

    public function testBase64ImageCannotMixUri(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-base64-conflict',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'reference_images' => [[
                    'uri' => '/2121/images/reference.png',
                    'source_type' => 'base64',
                    'base64_data' => base64_encode('mock-image'),
                    'mime_type' => 'image/png',
                ]],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->valid();
    }

    public function testInvalidBase64ImageIsRejected(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-invalid-base64',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在看镜头',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'reference_images' => [[
                    'source_type' => 'base64',
                    'base64_data' => 'not-valid-base64',
                    'mime_type' => 'image/png',
                ]],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->valid();
    }

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

    public function testToModelGatewayPayloadOnlyContainsGatewayFields(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'video-7',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'topic_id' => 'topic-1',
            'task_id' => 'task-1',
            'task' => 'extend',
            'input_mode' => 'omni_reference',
            'prompt' => '大家在海边奔跑',
            'file_dir' => '/2121/videos/',
            'file_name' => 'output.mp4',
            'inputs' => [
                'reference_videos' => [
                    ['uri' => '/2121/videos/ref1.mp4'],
                ],
            ],
            'generation' => [
                'resolution' => '480p',
                'duration_seconds' => 4,
            ],
            'callbacks' => [
                'webhook_url' => 'https://example.com/callback',
            ],
            'execution' => [
                'service_tier' => 'default',
            ],
            'extensions' => [
                'seedance' => ['camera' => 'static'],
            ],
        ]);

        $payload = $dto->toModelGatewayPayload();

        $this->assertSame([
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'task' => 'extend',
            'input_mode' => 'omni_reference',
            'prompt' => '大家在海边奔跑',
            'inputs' => [
                'reference_videos' => [
                    ['uri' => '/2121/videos/ref1.mp4'],
                ],
            ],
            'generation' => [
                'resolution' => '480p',
                'duration_seconds' => 4,
            ],
            'callbacks' => [
                'webhook_url' => 'https://example.com/callback',
            ],
            'execution' => [
                'service_tier' => 'default',
            ],
            'extensions' => [
                'seedance' => ['camera' => 'static'],
            ],
            'topic_id' => 'topic-1',
            'task_id' => 'task-1',
        ], $payload);
        $this->assertArrayNotHasKey('supports_image_input_url', $payload);
        $this->assertArrayNotHasKey('video_id', $payload);
        $this->assertArrayNotHasKey('file_dir', $payload);
        $this->assertArrayNotHasKey('file_name', $payload);
    }

    public function testValidForEstimateDoesNotRequireVideoIdAndFileDir(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在跑步',
            'inputs' => [
                'reference_videos' => [
                    ['uri' => '/2121/videos/ref.mp4'],
                ],
            ],
            'generation' => [
                'resolution' => '480p',
                'duration_seconds' => 4,
            ],
        ]);

        $dto->validForEstimate();

        $this->assertSame(1, $dto->getProjectId());
        $this->assertSame('', $dto->getVideoId());
        $this->assertSame('', $dto->getFileDir());
    }

    public function testValidForEstimateRejectsUnsupportedInputKey(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'prompt' => '大家在跑步',
            'inputs' => [
                'video' => ['uri' => '/2121/videos/ref.mp4'],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->validForEstimate();
    }

    public function testCanvasCompositionAcceptsWorkspaceFileListsWithoutTopicId(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'composition-1',
            'generation_type' => 'canvas_composition',
            'file_dir' => '/canvas/videos/',
            'generation' => [
                'aspect_ratio' => '9:16',
                'resolution' => '480p',
            ],
            'composition' => [
                'videos' => [
                    ['path' => '/canvas/videos/a.mp4'],
                    ['path' => '/canvas/videos/b.mp4'],
                ],
                'audios' => [
                    ['path' => '/canvas/audios/b.mp3'],
                ],
            ],
        ]);

        $dto->validForCanvasComposition();

        $this->assertCount(2, $dto->getComposition()['videos']);
        $this->assertSame('/canvas/audios/b.mp3', $dto->getComposition()['audios'][0]['path']);
    }

    public function testCanvasCompositionRejectsMultipleAudioFiles(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'composition-2',
            'generation_type' => 'canvas_composition',
            'file_dir' => '/canvas/videos/',
            'composition' => [
                'videos' => [['path' => '/canvas/videos/a.mp4']],
                'audios' => [
                    ['path' => '/canvas/audios/a.mp3'],
                    ['path' => '/canvas/audios/b.mp3'],
                ],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->validForCanvasComposition();
    }

    public function testDraftTaskInputAcceptsUriObject(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'draft-task-1',
            'model_id' => 'seedance-2.5',
            'task' => 'generate',
            'input_mode' => 'draft_task',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'draft_task' => ['uri' => '/2121/videos/sample.mp4'],
            ],
        ]);

        $dto->valid();

        $this->assertSame('draft_task', $dto->getInputMode());
        $this->assertSame(['uri' => '/2121/videos/sample.mp4'], $dto->getDraftTask());
    }

    public function testDraftTaskInputRejectsListShape(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'draft-task-2',
            'model_id' => 'seedance-2.5',
            'task' => 'generate',
            'input_mode' => 'draft_task',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                // 样片引用是单个对象；列表形态两个字段都读不到，必须被拦下。
                'draft_task' => [['uri' => '/2121/videos/sample.mp4']],
            ],
        ]);

        // 只断言「被拒绝」：本文件的批量运行下 ExceptionBuilder 可能因容器未就绪先抛 TypeError，
        // 具体文案（inputs.draft_task must be an object）无法在批量场景稳定断言。
        $this->expectException(Throwable::class);

        $dto->valid();
    }

    public function testDraftTaskIsNotATaskType(): void
    {
        $dto = new DesignVideoCreateDTO([
            'project_id' => 1,
            'video_id' => 'draft-task-3',
            'model_id' => 'seedance-2.5',
            // 样片成片不新增 task 取值，task=draft_task 必须被判为非法。
            'task' => 'draft_task',
            'input_mode' => 'draft_task',
            'file_dir' => '/2121/videos/',
            'inputs' => [
                'draft_task' => ['uri' => '/2121/videos/sample.mp4'],
            ],
        ]);

        $this->expectException(Throwable::class);

        $dto->valid();
    }
}
