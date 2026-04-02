<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Crontab\Process\CrontabDispatcherProcess;

return [
    CrontabDispatcherProcess::class,
    // TODO: Redis 视频队列当前仍有待修复问题：
    // 1. running 槽位没有僵尸任务恢复机制
    // 2. heartbeat 没有参与槽位回收
    // 3. worker 异常退出后可能长期占住并发
    // 修复前不要重新把 VideoQueueWorkerProcess 接回视频执行链。
];
