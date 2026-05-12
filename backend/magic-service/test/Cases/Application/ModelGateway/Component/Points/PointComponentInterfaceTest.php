<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Component\Points;

use App\Application\ModelGateway\Component\Points\DTO\PointEstimateResult;
use App\Application\ModelGateway\Component\Points\DTO\VideoPointEstimateRequest;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionNamedType;

/**
 * @internal
 */
class PointComponentInterfaceTest extends TestCase
{
    public function testEstimateVideoPointsUsesVideoRequestAndAppResult(): void
    {
        $this->assertFalse(method_exists(PointComponentInterface::class, 'estimatePoints'));

        $method = new ReflectionMethod(PointComponentInterface::class, 'estimateVideoPoints');
        $parameters = $method->getParameters();
        $requestType = $parameters[0]->getType();
        $dataIsolationType = $parameters[1]->getType();
        $returnType = $method->getReturnType();

        $this->assertCount(2, $parameters);
        $this->assertInstanceOf(ReflectionNamedType::class, $requestType);
        $this->assertSame(VideoPointEstimateRequest::class, $requestType->getName());
        $this->assertInstanceOf(ReflectionNamedType::class, $dataIsolationType);
        $this->assertSame(ModelGatewayDataIsolation::class, $dataIsolationType->getName());
        $this->assertInstanceOf(ReflectionNamedType::class, $returnType);
        $this->assertSame(PointEstimateResult::class, $returnType->getName());
    }
}
