<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Event;

use App\Domain\Audit\Entity\ValueObject\RequestInfo;
use App\Domain\Audit\Entity\ValueObject\UserAuthorization;
use App\Infrastructure\Core\AbstractEvent;

/**
 * 管理员操作日志事件.
 */
class AdminOperationLogEvent extends AbstractEvent
{
    public function __construct(
        protected UserAuthorization $authorization,
        protected string $matchedPermissionKey,
        protected RequestInfo $requestInfo,
        protected string $className,
        protected string $methodName
    ) {
    }

    public function getAuthorization(): UserAuthorization
    {
        return $this->authorization;
    }

    public function getMatchedPermissionKey(): string
    {
        return $this->matchedPermissionKey;
    }

    public function getRequestInfo(): RequestInfo
    {
        return $this->requestInfo;
    }

    public function getClassName(): string
    {
        return $this->className;
    }

    public function getMethodName(): string
    {
        return $this->methodName;
    }
}
