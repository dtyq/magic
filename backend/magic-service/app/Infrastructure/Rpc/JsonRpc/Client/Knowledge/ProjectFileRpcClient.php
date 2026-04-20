<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Client\AbstractRpcClient;
use App\Infrastructure\Rpc\Method\SvcMethods;

#[RpcClient(name: SvcMethods::SERVICE_KNOWLEDGE_PROJECT_FILE)]
class ProjectFileRpcClient extends AbstractRpcClient
{
    #[RpcMethod(name: SvcMethods::METHOD_NOTIFY_CHANGE)]
    public function notifyChange(int $projectFileId): bool
    {
        $this->callRpc(__FUNCTION__, [
            'project_file_id' => $projectFileId,
        ]);
        return true;
    }
}
