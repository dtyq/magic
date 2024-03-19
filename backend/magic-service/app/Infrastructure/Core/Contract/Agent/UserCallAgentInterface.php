<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Agent;

use App\Domain\Chat\Event\Agent\UserCallAgentEvent;

interface UserCallAgentInterface
{
    /**
     * 处理用户调用 Agent 的事件.
     */
    public function process(UserCallAgentEvent $event): void;

    /**
     * 判断当前处理器是否可以处理该 AI Code.
     */
    public function canHandle(string $aiCode): bool;

    /**
     * 获取处理器优先级.
     *
     * 数字越大优先级越高，默认为0
     * 企业版可以返回更高的优先级以覆盖默认实现
     */
    public static function getPriority(): int;
}
