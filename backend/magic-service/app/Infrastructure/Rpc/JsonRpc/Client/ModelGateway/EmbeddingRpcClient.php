<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\ModelGateway;

use App\Application\KnowledgeBase\Port\EmbeddingProviderPort;
use App\Application\ModelGateway\DTO\Common\BusinessParamsDTO;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;

/**
 * Embedding RPC IPC 客户端实现.
 *
 * 通过 IPC 调用 Go Engine 获取 embedding providers
 */
#[RpcClient(name: SvcMethods::SERVICE_MODEL_GATEWAY_EMBEDDING)]
class EmbeddingRpcClient extends AbstractRpcClient implements EmbeddingProviderPort
{
    /**
     * 获取嵌入提供商列表.
     */
    #[RpcMethod(name: SvcMethods::METHOD_PROVIDERS_LIST)]
    public function listProviders(BusinessParamsDTO $businessParams): array
    {
        return $this->callRpc(__FUNCTION__, [
            'business_params' => $businessParams->toArray(),
        ]);
    }
}
