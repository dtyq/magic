<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Tool\ImageGeneration;

use App\Application\Design\Tool\ImageGeneration\Handler\DesignUpscaleImageTaskHandler;
use App\Application\ModelGateway\Service\ImageLLMAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class DesignUpscaleImageTaskHandlerTest extends BaseTest
{
    public function testHandlePassesRequestedSizeToModelGateway(): void
    {
        $sourcePath = '/source.png';
        $workspacePrefix = '/org/project_1/workspace';
        $fullSourcePath = $workspacePrefix . $sourcePath;

        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->expects($this->once())
            ->method('getLinks')
            ->with(
                'org',
                [$fullSourcePath],
                StorageBucketType::SandBox,
                [],
                []
            )
            ->willReturn([
                $fullSourcePath => new FileLink($fullSourcePath, 'https://example.test/source.png', 3600),
            ]);

        $imageLLMAppService = $this->createMock(ImageLLMAppService::class);
        $imageLLMAppService->expects($this->once())
            ->method('imageConvertHighV2')
            ->with($this->callback(static function (ImageConvertHighDTO $dto): bool {
                return $dto->getImages() === ['https://example.test/source.png']
                    && $dto->getSize() === '4096x4096';
            }))
            ->willReturn(new OpenAIFormatResponse([
                'data' => [
                    ['url' => 'https://example.test/high.png'],
                ],
            ]));

        $entity = new ImageGenerationEntity();
        $entity->setReferenceImages([$sourcePath]);
        $entity->setSize('4096x4096');

        $handler = new DesignUpscaleImageTaskHandler(
            new FileDomainService($cloudFileRepository),
            $imageLLMAppService
        );

        $response = $handler->handle(
            DesignDataIsolation::create('org', 'user_1'),
            $entity,
            $workspacePrefix
        );

        $this->assertInstanceOf(OpenAIFormatResponse::class, $response);
    }
}
