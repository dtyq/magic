<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Context;

use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Snowflake\IdGeneratorInterface;

class CoContext
{
    public static function getOrSetRequestId()
    {
        return Context::getOrSet('request-id', self::generateRequestId());
    }

    public static function getRequestId(): string
    {
        return (string) Context::get('request-id', '');
    }

    public static function setRequestId(?string $requestId = null)
    {
        return Context::set('request-id', $requestId);
    }

    public static function getTraceId(): string
    {
        return Context::get('x-b3-trace-id', '');
    }

    public static function setTraceId(?string $tranceId = null)
    {
        return Context::set('x-b3-trace-id', $tranceId);
    }

    public static function setLanguage(string $language): void
    {
        Context::set('language', $language);
    }

    public static function getLanguage(): string
    {
        return Context::get('language', 'zh_CN') ?: 'zh_CN';
    }

    /**
     * @deprecated
     */
    public static function getSeqId(): string
    {
        return Context::get('magic-chat-seq-id', '');
    }

    /**
     * @deprecated
     */
    public static function setSeqId(?string $seqId = null)
    {
        return Context::set('magic-chat-seq-id', $seqId);
    }

    public static function copy(int $fromCoroutineId): void
    {
        Context::copy($fromCoroutineId, ['request-id', 'x-b3-trace-id']);
    }

    public static function getRequestContext(): ?RequestContext
    {
        return Context::get('magic-request-context', null);
    }

    public static function setRequestContext(RequestContext $requestContext): void
    {
        Context::set('magic-request-context', $requestContext);
    }

    private static function generateRequestId(): int
    {
        return ApplicationContext::getContainer()->get(IdGeneratorInterface::class)->generate();
    }
}
