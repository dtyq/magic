<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\HighAvailability;

use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\HighAvailability\Service\ModelGatewayEndpointProvider;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\GetMapping;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

/**
 * 高可用性相关 API 接口.
 */
#[Controller(prefix: '/api/v1/high-available')]
#[ApiResponse('low_code')]
class HighAvailabilityApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly ModelGatewayEndpointProvider $endpointProvider
    ) {
        parent::__construct($request);
    }

    /**
     * 获取模型端点列表.
     */
    #[GetMapping(path: '/models/endpoints')]
    public function getModelsEndpoints()
    {
        // 从请求头获取组织编码
        $orgCode = $this->request->getHeaderLine('organization-code');

        // 从查询参数获取endpoint_type（支持查询参数方式）
        $endpointType = $this->request->query('endpoint_type', '');

        // 如果查询参数为空，尝试从请求体获取
        if (empty($endpointType)) {
            $body = $this->request->getParsedBody();
            $endpointType = $body['endpoint_type'] ?? '';
        }

        // 验证必需参数
        if (empty($endpointType)) {
            throw new InvalidArgumentException('缺少必需参数：endpoint_type');
        }

        if (empty($orgCode)) {
            throw new InvalidArgumentException('缺少必需参数：organization-code 请求头');
        }

        // 从查询参数获取可选参数
        $provider = $this->request->query('provider');
        $endpointName = $this->request->query('endpoint_name');

        // 调用服务获取端点列表
        return $this->endpointProvider->getEndpoints(
            $endpointType,  // 使用endpoint_type作为model_id
            $orgCode,
            $provider,
            $endpointName
        );
    }
}
