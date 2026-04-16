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

    /**
     * @param array<string, string> $links
     * @param array<string, string> $downloads
     */
    private function createBuilder(array $links, array $downloads = []): VideoGatewayPayloadBuilder
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
