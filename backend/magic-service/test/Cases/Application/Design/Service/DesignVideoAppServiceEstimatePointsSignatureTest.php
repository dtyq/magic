<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Service\DesignVideoAppService;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Interfaces\Design\DTO\VideoPointEstimateDTO;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionNamedType;

/**
 * @internal
 */
class DesignVideoAppServiceEstimatePointsSignatureTest extends TestCase
{
    public function testEstimatePointsUsesDesignVideoDtoAndReturnsResponseDto(): void
    {
        $method = new ReflectionMethod(DesignVideoAppService::class, 'estimatePoints');
        $parameters = $method->getParameters();

        $this->assertCount(2, $parameters);
        $requestType = $parameters[1]->getType();
        $returnType = $method->getReturnType();

        $this->assertInstanceOf(ReflectionNamedType::class, $requestType);
        $this->assertSame(DesignVideoCreateDTO::class, $requestType->getName());
        $this->assertInstanceOf(ReflectionNamedType::class, $returnType);
        $this->assertSame(VideoPointEstimateDTO::class, $returnType->getName());
    }
}
