<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer\Command;

use Hyperf\Command\Command;
use Hyperf\Redis\RedisFactory;

/**
 * Disable the original socketio:clear command.
 *
 * The upstream command scans Redis from the PHP process. Socket.IO Redis cleanup
 * is now handled by the Go RPC method svc.socketio.redis.cleanup, which runs one
 * bounded SCAN page per request and returns the cursor for external pacing.
 */
class RemoveRedisGarbage extends Command
{
    public function __construct(RedisFactory $factory)
    {
        unset($factory);
        parent::__construct('socketio:clear');
    }

    public function handle(): int
    {
        $this->output->warning('socketio:clear is disabled. Use Go RPC svc.socketio.redis.cleanup for bounded Socket.IO prefix cleanup.');
        return 1;
    }
}
