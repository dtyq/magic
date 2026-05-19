<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

enum GoEngineSupervisorReason: string
{
    case ProcessExited = 'process_exited';
    case RpcUnhealthyTimeout = 'rpc_unhealthy_timeout';
    case NoHealthyRpcConnection = 'no_healthy_rpc_connection';
    case GoEngineStartFailed = 'go_engine_start_failed';
    case RpcNotReadyAfterRestart = 'rpc_not_ready_after_restart';
    case GoEngineRestartException = 'go_engine_restart_exception';
}
