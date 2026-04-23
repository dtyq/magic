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
 * 模型网关积分组件接口，开源包可空实现，企业包负责真实余额校验和费用预估。
 */
interface PointComponentInterface
{
    public function checkPointsSufficient(ProxyModelRequestInterface $proxyModelRequest, ModelGatewayDataIsolation $modelGatewayDataIsolation): void;

    /**
     * 预估视频生成积分，默认实现可返回 0，企业包负责真实计算。
     */
    public function estimateVideoPoints(VideoPointEstimateRequest $request, ModelGatewayDataIsolation $modelGatewayDataIsolation): PointEstimateResult;
}
