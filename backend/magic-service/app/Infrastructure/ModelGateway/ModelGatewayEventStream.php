<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway;

use App\Infrastructure\Core\Hyperf\EventStream;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Engine\Contract\Http\Writable;
use Hyperf\Logger\LoggerFactory;
use LogicException;
use Psr\Http\Message\ResponseInterface;
use Swow\SocketException;
use Throwable;

/** 模型网关输出：下游失效后停止发送，让原上游流继续消费至完成。 */
class ModelGatewayEventStream extends EventStream
{
    private bool $writable = true;

    private bool $ended = false;

    /** 初始化响应头；仅隔离下游传输异常，保留其他构造错误。 */
    public function __construct(Writable $connection, ?ResponseInterface $response = null)
    {
        try {
            parent::__construct($connection, $response);
        } catch (SocketException $exception) {
            $this->detach('headers', $exception);
        }
    }

    /** 写入失败后不再触碰下游连接，但不打断调用方的上游迭代。 */
    public function write(string $data): self
    {
        if (! $this->writable) {
            return $this;
        }
        if ($this->ended) {
            throw new LogicException('流式响应已经结束');
        }
        try {
            if (! $this->connection->write($data)) {
                $this->detach('write');
            }
        } catch (SocketException $exception) {
            $this->detach('write', $exception);
        }
        return $this;
    }

    /** 最多结束一次响应，失效后不重试写入或关闭共享TCP连接。 */
    public function end(): void
    {
        if ($this->ended) {
            return;
        }
        $this->ended = true;
        if (! $this->writable) {
            return;
        }
        try {
            if ($this->connection->end() === false) {
                $this->detach('end');
            }
        } catch (SocketException $exception) {
            $this->detach('end', $exception);
        }
    }

    /** 标记首次下游失效并记录脱敏告警，日志故障不能影响上游消费。 */
    private function detach(string $phase, ?SocketException $exception = null): void
    {
        if (! $this->writable) {
            return;
        }
        $this->writable = false;
        try {
            di(LoggerFactory::class)->get('model-gateway')->warning('模型流下游不可写，继续消费上游', [
                'request_id' => CoContext::getRequestId(),
                'phase' => $phase,
                'exception_class' => $exception ? $exception::class : null,
                'exception_code' => $exception?->getCode(),
                'downstream_writable' => false,
            ]);
        } catch (Throwable) {
            // 日志仅用于诊断，不允许日志设施故障终止模型计量。
        }
    }
}
