<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;

#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_TEAMSHARE)]
class TeamshareKnowledgeRpcClient extends AbstractRpcClient
{
    #[RpcMethod(name: SvcMethods::METHOD_START_VECTOR)]
    public function startVector(KnowledgeBaseRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_id' => (string) ($request->payload['knowledge_id'] ?? ''),
        ]);
    }

    #[RpcMethod(name: SvcMethods::METHOD_MANAGEABLE)]
    public function manageable(KnowledgeBaseRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
        ]);
    }

    #[RpcMethod(name: SvcMethods::METHOD_MANAGEABLE_PROGRESS)]
    public function manageableProgress(KnowledgeBaseRequestDTO $request): array
    {
        return $this->callRpc(__FUNCTION__, [
            'data_isolation' => $request->dataIsolation->toArray(),
            'knowledge_codes' => array_values(array_map('strval', (array) ($request->payload['knowledge_codes'] ?? []))),
        ]);
    }
}
