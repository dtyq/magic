<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points;

use App\Application\ModelGateway\Component\Points\DTO\PointEstimateResult;
use App\Application\ModelGateway\Component\Points\DTO\VideoPointEstimateRequest;
use App\Domain\ModelGateway\Entity\Dto\ProxyModelRequestInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;

/**
 * 开源版积分组件占位实现，企业版会通过同名接口替换为真实计费逻辑。
 */
class PointComponent implements PointComponentInterface
{
    public function checkPointsSufficient(ProxyModelRequestInterface $proxyModelRequest, ModelGatewayDataIsolation $modelGatewayDataIsolation): void
    {
    }

    public function estimateVideoPoints(VideoPointEstimateRequest $request, ModelGatewayDataIsolation $modelGatewayDataIsolation): PointEstimateResult
    {
        return PointEstimateResult::zero($request->getResourceType());
    }
}
