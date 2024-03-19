<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Coroutine\AutoCopy;

use Closure;
use Hyperf\Context\Context;
use Hyperf\Context\RequestContext;

use function Hyperf\Support\call;

readonly class CoroutineCreateCallProxy
{
    public function __construct(
        protected Closure $callable,
        protected int $fromCoroutineId,
        protected array $keys = []
    ) {
    }

    public function run(): void
    {
        // 重新设置 RequestContext，避免 RequestContext 丢失
        $lastRequest = RequestContext::getOrNull($this->fromCoroutineId);
        if ($lastRequest) {
            RequestContext::set($lastRequest);
            // 只有发起请求的时候，协程上下文复制 request-id
            Context::copy($this->fromCoroutineId, $this->getKeys());
        }

        call($this->callable);
    }

    protected function getKeys(): array
    {
        return array_merge(['request-id'], $this->keys);
    }
}
