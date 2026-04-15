<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\ModelGateway\Rpc\Service;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelListType;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\ModelGateway\Rpc\Service\EmbeddingRpcService;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Contract\Api\Response\ResponseInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class EmbeddingRpcServiceTest extends TestCase
{
    public function testListProvidersShouldUseEmbeddingModelListType(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $llmAppService = $this->createMock(LLMAppService::class);

        $llmAppService->expects($this->once())
            ->method('models')
            ->with(
                'token_xxx',
                true,
                ModelListType::EMBEDDING,
                $this->callback(function (array $businessParams): bool {
                    return ($businessParams['organization_code'] ?? '') === 'DT001';
                })
            )
            ->willReturn([]);

        $service = new EmbeddingRpcService($llmAppService, $logger);
        $result = $service->listProviders([
            'access_token' => 'token_xxx',
            'business_params' => [
                'organization_code' => 'DT001',
            ],
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
        $this->assertSame([], $result['data']);
    }

    public function testComputeShouldPassBusinessParamsToEmbeddingsDTOAndReturnDataData(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $llmAppService = $this->createMock(LLMAppService::class);

        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->with($this->callback(function ($dto): bool {
                if (! $dto instanceof EmbeddingsDTO) {
                    return false;
                }
                $businessParams = $dto->getBusinessParams();
                return ($businessParams['organization_code'] ?? '') === 'DT001'
                    && ($businessParams['user_id'] ?? '') === 'usi_xxx'
                    && ($businessParams['business_id'] ?? '') === 'KNOWLEDGE-xxx';
            }))
            ->willReturn(new EmbeddingResponse(new PsrResponse(
                200,
                ['Content-Type' => 'application/json'],
                '{"object":"list","data":[{"object":"embedding","embedding":[0.1,0.2],"index":0}],"model":"text-embedding-3-large","usage":{"prompt_tokens":1,"total_tokens":1}}'
            )));

        $service = new EmbeddingRpcService($llmAppService, $logger);
        $result = $service->compute([
            'model' => 'text-embedding-3-large',
            'input' => ['hello'],
            'access_token' => 'token_xxx',
            'business_params' => [
                'organization_code' => 'DT001',
                'user_id' => 'usi_xxx',
                'business_id' => 'KNOWLEDGE-xxx',
            ],
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
        $this->assertCount(1, $result['data']['data']);
        $this->assertSame([0.1, 0.2], $result['data']['data'][0]['embedding']);
        $this->assertSame(0, $result['data']['data'][0]['index']);
    }

    public function testComputeShouldReturn500WhenResponseIsNotEmbeddingResponse(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())->method('error');

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->willReturn(new class implements ResponseInterface {
                public function getUsage(): ?Usage
                {
                    return null;
                }
            });

        $service = new EmbeddingRpcService($llmAppService, $logger);
        $result = $service->compute([
            'model' => 'text-embedding-3-large',
            'input' => ['hello'],
            'access_token' => 'token_xxx',
            'business_params' => [
                'organization_code' => 'DT001',
                'user_id' => 'usi_xxx',
                'business_id' => 'KNOWLEDGE-xxx',
            ],
        ]);

        $this->assertSame(500, $result['code']);
        $this->assertStringContainsString('unexpected embedding response type', $result['message']);
        $this->assertSame(0, $result['error_code']);
    }

    public function testComputeShouldExposeBusinessErrorCodeWhenBusinessExceptionThrown(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())->method('error');

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->willThrowException(new BusinessException('API令牌不存在', 4000));

        $service = new EmbeddingRpcService($llmAppService, $logger);
        $result = $service->compute([
            'model' => 'text-embedding-3-large',
            'input' => ['hello'],
            'access_token' => 'token_xxx',
            'business_params' => [
                'organization_code' => 'DT001',
                'user_id' => 'usi_xxx',
                'business_id' => 'KNOWLEDGE-xxx',
            ],
        ]);

        $this->assertSame(500, $result['code']);
        $this->assertSame('API令牌不存在', $result['message']);
        $this->assertSame(4000, $result['error_code']);
    }

    public function testListProvidersShouldExposeBusinessErrorCodeWhenBusinessExceptionThrown(): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())->method('error');

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('models')
            ->willThrowException(new BusinessException('API令牌被禁用', 4019));

        $service = new EmbeddingRpcService($llmAppService, $logger);
        $result = $service->listProviders([
            'access_token' => 'token_xxx',
            'business_params' => [
                'organization_code' => 'DT001',
            ],
        ]);

        $this->assertSame(500, $result['code']);
        $this->assertSame('API令牌被禁用', $result['message']);
        $this->assertSame(4019, $result['error_code']);
    }
}
