<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Exception\Handler;

use App\ErrorCode\HttpErrorCode;
use Hyperf\Codec\Json;
use Hyperf\ExceptionHandler\ExceptionHandler;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Psr\Http\Message\MessageInterface;
use Psr\Http\Message\ResponseInterface;
use Qbhy\HyperfAuth\Exception\UnauthorizedException;
use Throwable;

class AuthExceptionHandler extends ExceptionHandler
{
    public function handle(Throwable $throwable, ResponseInterface $response): MessageInterface|ResponseInterface
    {
        $this->stopPropagation();
        $data = [
            'code' => HttpErrorCode::Unauthorized->value,
            'message' => $throwable->getMessage(),
        ];
        return $response
            ->withAddedHeader('content-type', 'application/json; charset=utf-8')
            ->withBody(new SwooleStream(Json::encode($data)));
    }

    public function isValid(Throwable $throwable): bool
    {
        return $throwable instanceof UnauthorizedException;
    }
}
