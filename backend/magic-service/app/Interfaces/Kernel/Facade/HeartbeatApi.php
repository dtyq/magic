<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Infrastructure\Rpc\Health\HeartbeatStatusService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface as HttpResponse;

class HeartbeatApi
{
    #[Inject]
    protected HeartbeatStatusService $heartbeatStatusService;

    #[Inject]
    protected HttpResponse $response;

    public function heartbeat()
    {
        $payload = $this->heartbeatStatusService->inspect();
        $httpCode = (int) ($payload['httpCode'] ?? 200);
        unset($payload['httpCode']);

        return $this->response->json($payload)->withStatus($httpCode);
    }
}
