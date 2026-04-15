<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Rpc\Service;

use App\Application\ModelGateway\Official\MagicAccessToken;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;

#[RpcService(name: SvcMethods::SERVICE_MODEL_GATEWAY_ACCESS_TOKEN)]
class AccessTokenRpcService
{
    #[RpcMethod(name: SvcMethods::METHOD_GET)]
    public function getAccessToken(array $params): array
    {
        MagicAccessToken::init();

        if (! defined('MAGIC_ACCESS_TOKEN')) {
            return [
                'code' => 500,
                'message' => 'magic access token not initialized',
            ];
        }

        return [
            'code' => 0,
            'message' => 'success',
            'data' => [
                'access_token' => MAGIC_ACCESS_TOKEN,
            ],
        ];
    }
}
