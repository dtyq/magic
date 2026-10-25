<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\ProviderModelAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class ProviderModelAppServiceTest extends TestCase
{
    public function testResolveVideoGenerationConfigUsesFullModelIdAndProviderCode(): void
    {
        $videoConfig = new VideoGenerationConfig(['supported_inputs' => ['text_prompt']]);
        $videoGenerationConfigDomainService = $this->createMock(VideoGenerationConfigDomainService::class);
        $videoGenerationConfigDomainService
            ->expects($this->once())
            ->method('resolve')
            ->with('MiniMax-H3', 'org-1_MiniMax-H3', ProviderCode::MiniMax)
            ->willReturn($videoConfig);

        $service = new ProviderModelAppService(
            $this->createMock(ProviderModelDomainService::class),
            $this->createMock(FileDomainService::class),
            $this->createMock(ProviderConfigDomainService::class),
            $videoGenerationConfigDomainService,
        );

        $model = new ProviderModelEntity([
            'model_id' => 'org-1_MiniMax-H3',
            'model_version' => 'MiniMax-H3',
            'model_type' => ModelType::TEXT_TO_VIDEO,
            'category' => Category::VGM,
        ]);
        $providerConfig = new ProviderConfigEntity();
        $providerConfig->setProviderCode(ProviderCode::MiniMax);

        $result = $this->invokePrivate($service, 'resolveVideoGenerationConfig', $model, $providerConfig);

        $this->assertSame($videoConfig, $result);
    }

    public function testResolveVideoGenerationConfigSkipsNonVideoModel(): void
    {
        $videoGenerationConfigDomainService = $this->createMock(VideoGenerationConfigDomainService::class);
        $videoGenerationConfigDomainService->expects($this->never())->method('resolve');

        $service = new ProviderModelAppService(
            $this->createMock(ProviderModelDomainService::class),
            $this->createMock(FileDomainService::class),
            $this->createMock(ProviderConfigDomainService::class),
            $videoGenerationConfigDomainService,
        );

        $model = new ProviderModelEntity([
            'model_id' => 'gpt-4.1',
            'model_version' => 'gpt-4.1',
            'model_type' => ModelType::LLM,
            'category' => Category::LLM,
        ]);

        $this->assertNull($this->invokePrivate($service, 'resolveVideoGenerationConfig', $model, null));
    }

    private function invokePrivate(object $object, string $method, mixed ...$args): mixed
    {
        $reflectionMethod = new ReflectionMethod($object, $method);
        $reflectionMethod->setAccessible(true);

        return $reflectionMethod->invoke($object, ...$args);
    }
}
