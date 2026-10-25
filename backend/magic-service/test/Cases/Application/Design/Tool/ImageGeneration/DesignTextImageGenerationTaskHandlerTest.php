<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Tool\ImageGeneration;

use App\Application\Design\Tool\ImageGeneration\Handler\DesignTextImageGenerationTaskHandler;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DesignTextImageGenerationTaskHandlerTest extends TestCase
{
    public function testHandlePassesGenerateNumToModelGateway(): void
    {
        if (! defined('MAGIC_ACCESS_TOKEN')) {
            define('MAGIC_ACCESS_TOKEN', 'test-token');
        }

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('textGenerateImageV2')
            ->with($this->callback(static function (TextGenerateImageDTO $dto): bool {
                return $dto->getModel() === 'gpt-image-2'
                    && $dto->getPrompt() === 'make posters'
                    && $dto->getN() === 3
                    && $dto->getBusinessParam('source_id') === SourceId::DESIGN_IMAGE_GENERATION
                    && $dto->getBusinessParam('business_id') === '101';
            }))
            ->willReturn(new OpenAIFormatResponse([
                'data' => [
                    ['url' => 'https://example.test/one.png'],
                    ['url' => 'https://example.test/two.png'],
                    ['url' => 'https://example.test/three.png'],
                ],
            ]));

        $entity = new ImageGenerationEntity();
        $entity->setProjectId(101);
        $entity->setModelId('gpt-image-2');
        $entity->setPrompt('make posters');
        $entity->setGenerateNum(3);

        $handler = new DesignTextImageGenerationTaskHandler(
            new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)),
            $this->createMock(TaskFileDomainService::class),
            $llmAppService
        );

        $response = $handler->handle(
            $this->buildDesignDataIsolation(),
            $entity,
            '/org/project_1/workspace'
        );

        $this->assertInstanceOf(OpenAIFormatResponse::class, $response);
    }

    private function buildDesignDataIsolation(): DesignDataIsolation
    {
        return new class extends DesignDataIsolation {
            public function __construct()
            {
            }

            public function getCurrentOrganizationCode(): string
            {
                return 'org';
            }

            public function getCurrentUserId(): string
            {
                return 'user_1';
            }
        };
    }
}
