<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\DTO\Embedding;

use App\Application\ModelGateway\DTO\Embedding\EmbeddingComputeParamsDTO;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class EmbeddingComputeParamsDTOTest extends TestCase
{
    public function testBusinessParamsShouldPreserveSourceIdAndExtraParams(): void
    {
        $dto = EmbeddingComputeParamsDTO::fromArray([
            'model' => 'doubao-embedding-vision',
            'input' => 'hello',
            'business_params' => [
                'organization_id' => 'ORG001',
                'user_id' => 'USER001',
                'business_id' => 'KB001',
                'source_id' => SourceId::FRAGMENT_SAVED,
                'provider_model_id' => 'MODEL001',
            ],
        ]);

        $businessParams = $dto->businessParams->toArray();
        $this->assertSame('ORG001', $businessParams['organization_code']);
        $this->assertSame('ORG001', $businessParams['organization_id']);
        $this->assertSame('USER001', $businessParams['user_id']);
        $this->assertSame('KB001', $businessParams['business_id']);
        $this->assertSame(SourceId::FRAGMENT_SAVED, $businessParams['source_id']);
        $this->assertSame('MODEL001', $businessParams['provider_model_id']);
    }
}
