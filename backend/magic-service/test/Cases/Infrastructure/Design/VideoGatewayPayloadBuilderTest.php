<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Design;

use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Design\VideoGatewayPayloadBuilder;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoGatewayPayloadBuilderTest extends TestCase
{
    public function testBuildConvertsReferenceImagesAndFramesToDataUrlByDefault(): void
    {
        $builder = $this->createBuilder(
            [],
            [
                '/org/project_1001/workspace/assets/ref.png' => 'reference-image',
                '/org/project_1001/workspace/assets/start.jpg' => 'frame-start',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => 'make a video',
            'model_id' => 'veo-3.1-generate-preview',
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/assets/ref.png', 'type' => 'asset'],
            ],
            'frames' => [
                ['role' => 'start', 'uri' => '/assets/start.jpg'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame('data:image/png;base64,' . base64_encode('reference-image'), $payload['inputs']['reference_images'][0]['uri']);
        $this->assertSame('asset', $payload['inputs']['reference_images'][0]['type']);
        $this->assertSame('start', $payload['inputs']['frames'][0]['role']);
        $this->assertSame('data:image/jpeg;base64,' . base64_encode('frame-start'), $payload['inputs']['frames'][0]['uri']);
    }

    public function testBuildUsesPlainUrlsWhenSupportsImageInputUrlIsEnabled(): void
    {
        $builder = $this->createBuilder(
            [
                '/org/project_1001/workspace/assets/ref.png' => 'https://cdn.example.com/ref.png',
                '/org/project_1001/workspace/assets/start.jpg' => 'https://cdn.example.com/start.jpg',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => 'make a video',
            'model_id' => 'doubao-seedance-2-0-fast-260128',
            'supports_image_input_url' => true,
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/assets/ref.png', 'type' => 'asset'],
            ],
            'frames' => [
                ['role' => 'start', 'uri' => '/assets/start.jpg'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame('https://cdn.example.com/ref.png', $payload['inputs']['reference_images'][0]['uri']);
        $this->assertSame('asset', $payload['inputs']['reference_images'][0]['type']);
        $this->assertSame('start', $payload['inputs']['frames'][0]['role']);
        $this->assertSame('https://cdn.example.com/start.jpg', $payload['inputs']['frames'][0]['uri']);
    }

    public function testBuildRewritesPromptMentionsForOmniReferenceUsingOriginalFileNames(): void
    {
        $builder = $this->createBuilder(
            [
                '/org/project_1001/workspace/1212/images/生成动物世界图_20260118220318 (2).jpg' => 'https://cdn.example.com/image-1.jpg',
                '/org/project_1001/workspace/1212/images/生成动物世界图_20260118220318 (1).jpg' => 'https://cdn.example.com/image-2.jpg',
                '/org/project_1001/workspace/1212/videos/钉钉录屏_2026-04-16 231755.mp4' => 'https://cdn.example.com/video-1.mp4',
                '/org/project_1001/workspace/1212/videos/video_20260415_223740.mp4' => 'https://cdn.example.com/video-2.mp4',
                '/org/project_1001/workspace/1212/audios/森格-看山不是山，看山还是山 (片段版)_副本.mp3' => 'https://cdn.example.com/audio-1.mp3',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => '@森格-看山不是山，看山还是山 (片段版)_副本.mp3 你好 '
                . '@森格-看山不是山，看山还是山 (片段版)_副本.mp3111 '
                . '@钉钉录屏_2026-04-16 231755.mp4 将人物+唱歌 '
                . '@video_20260415_223740.mp4 '
                . '@生成动物世界图_20260118220318 (2).jpg '
                . '@生成动物世界图_20260118220318 (1).jpg212',
            'input_mode' => 'omni_reference',
            'supports_image_input_url' => true,
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (1).jpg'],
                ],
                'reference_videos' => [
                    ['uri' => '/1212/videos/钉钉录屏_2026-04-16 231755.mp4'],
                    ['uri' => '/1212/videos/video_20260415_223740.mp4'],
                ],
                'reference_audios' => [
                    ['uri' => '/1212/audios/森格-看山不是山，看山还是山 (片段版)_副本.mp3'],
                ],
            ],
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                ['uri' => '/1212/images/生成动物世界图_20260118220318 (1).jpg'],
            ],
            'reference_videos' => [
                ['uri' => '/1212/videos/钉钉录屏_2026-04-16 231755.mp4'],
                ['uri' => '/1212/videos/video_20260415_223740.mp4'],
            ],
            'reference_audios' => [
                ['uri' => '/1212/audios/森格-看山不是山，看山还是山 (片段版)_副本.mp3'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame(
            '素材索引（右侧是用户上传的原始文件名，仅用于标识素材）：' . "\n"
            . '- 图片1：生成动物世界图_20260118220318 (2).jpg' . "\n"
            . '- 图片2：生成动物世界图_20260118220318 (1).jpg' . "\n"
            . '- 视频1：钉钉录屏_2026-04-16 231755.mp4' . "\n"
            . '- 视频2：video_20260415_223740.mp4' . "\n"
            . '- 音频1：森格-看山不是山，看山还是山 (片段版)_副本.mp3' . "\n\n"
            . '任务描述（请按素材编号理解下面的引用）：' . "\n"
            . '@音频1 你好 @音频1111 @视频1 将人物+唱歌 @视频2 @图片1 @图片2212',
            $payload['prompt']
        );
    }

    public function testBuildFormatsPromptForImageReferenceMode(): void
    {
        $builder = $this->createBuilder(
            [
                '/org/project_1001/workspace/1212/images/生成动物世界图_20260118220318 (2).jpg' => 'https://cdn.example.com/image-1.jpg',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => '@生成动物世界图_20260118220318 (2).jpg 让它动起来',
            'input_mode' => 'image_reference',
            'supports_image_input_url' => true,
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                ],
            ],
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame(
            '素材索引（右侧是用户上传的原始文件名，仅用于标识素材）：' . "\n"
            . '- 图片1：生成动物世界图_20260118220318 (2).jpg' . "\n\n"
            . '任务描述（请按素材编号理解下面的引用）：' . "\n"
            . '@图片1 让它动起来',
            $payload['prompt']
        );
    }

    public function testBuildFormatsPromptForImageReferenceModeWithDuplicateFileNames(): void
    {
        $builder = $this->createBuilder(
            [
                '/org/project_1001/workspace/1212/images/生成动物世界图_20260118220318 (2).jpg' => 'https://cdn.example.com/image-1.jpg',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => '@生成动物世界图_20260118220318 (2).jpg 和 @生成动物世界图_20260118220318 (2).jpg 一起动起来',
            'input_mode' => 'image_reference',
            'supports_image_input_url' => true,
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                ],
            ],
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame(
            '素材索引（右侧是用户上传的原始文件名，仅用于标识素材）：' . "\n"
            . '- 图片1：生成动物世界图_20260118220318 (2).jpg' . "\n\n"
            . '任务描述（请按素材编号理解下面的引用）：' . "\n"
            . '@图片1 和 @图片1 一起动起来',
            $payload['prompt']
        );
    }

    public function testBuildDoesNotRewritePromptMentionsOutsideReferenceModes(): void
    {
        $builder = $this->createBuilder();

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => '@生成动物世界图_20260118220318 (2).jpg',
            'input_mode' => 'keyframe_guided',
            'inputs' => [
                'reference_images' => [
                    ['uri' => '/1212/images/生成动物世界图_20260118220318 (2).jpg'],
                ],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame('@生成动物世界图_20260118220318 (2).jpg', $payload['prompt']);
    }

    public function testBuildKeepsIndependentIndexesWhenDifferentMediaShareSameBaseName(): void
    {
        $builder = $this->createBuilder(
            [
                '/org/project_1001/workspace/1212/images/素材A.png' => 'https://cdn.example.com/image-a.png',
                '/org/project_1001/workspace/1212/videos/素材A.mp4' => 'https://cdn.example.com/video-a.mp4',
                '/org/project_1001/workspace/1212/audios/素材A.mp3' => 'https://cdn.example.com/audio-a.mp3',
            ],
        );

        $entity = new DesignGenerationTaskEntity();
        $entity->setOrganizationCode('org');
        $entity->setProjectId(1001);
        $entity->setRequestPayload([
            'prompt' => '@素材A.mp3 配合 @素材A.mp4 和 @素材A.png',
            'input_mode' => 'omni_reference',
            'supports_image_input_url' => true,
            'inputs' => [
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
        ]);
        $entity->setInputPayload([
            'reference_images' => [
                ['uri' => '/1212/images/素材A.png'],
            ],
            'reference_videos' => [
                ['uri' => '/1212/videos/素材A.mp4'],
            ],
            'reference_audios' => [
                ['uri' => '/1212/audios/素材A.mp3'],
            ],
        ]);

        $payload = $builder->build($entity);

        $this->assertSame(
            '素材索引（右侧是用户上传的原始文件名，仅用于标识素材）：' . "\n"
            . '- 图片1：素材A.png' . "\n"
            . '- 视频1：素材A.mp4' . "\n"
            . '- 音频1：素材A.mp3' . "\n\n"
            . '任务描述（请按素材编号理解下面的引用）：' . "\n"
            . '@音频1 配合 @视频1 和 @图片1',
            $payload['prompt']
        );
    }

    /**
     * @param array<string, string> $links
     * @param array<string, string> $downloads
     */
    private function createBuilder(array $links = [], array $downloads = []): VideoGatewayPayloadBuilder
    {
        return new VideoGatewayPayloadBuilder($this->createFileDomainService($links, $downloads));
    }

    /**
     * @param array<string, string> $links
     * @param array<string, string> $downloads
     */
    private function createFileDomainService(array $links, array $downloads = []): FileDomainService
    {
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->method('getFullPrefix')->with('org')->willReturn('/org');
        $cloudFileRepository->method('getLinks')
            ->willReturnCallback(static function (string $organizationCode, array $filePaths) use ($links): array {
                $result = [];
                foreach ($filePaths as $filePath) {
                    if (array_key_exists($filePath, $links)) {
                        $result[$filePath] = new FileLink($filePath, $links[$filePath], 3600);
                    }
                }

                return $result;
            });
        $cloudFileRepository->method('downloadByChunks')
            ->willReturnCallback(static function (
                string $organizationCode,
                string $filePath,
                string $localPath,
            ) use ($downloads): void {
                if (! array_key_exists($filePath, $downloads)) {
                    return;
                }

                file_put_contents($localPath, $downloads[$filePath]);
            });

        return new FileDomainService($cloudFileRepository);
    }
}
