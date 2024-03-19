<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\IdGenerator;

use Hyperf\Context\ApplicationContext;
use Hyperf\Snowflake\IdGeneratorInterface;
use Ramsey\Uuid\Uuid;

class IdGenerator
{
    public static function getSnowId(): int
    {
        return ApplicationContext::getContainer()->get(IdGeneratorInterface::class)->generate();
    }

    public static function getMagicOrganizationCode(): string
    {
        return self::getUniqueId32();
    }

    /**
     * 生成固定长度(32位)的字符串,尽力保证唯一性.
     */
    public static function getUniqueId32(): string
    {
        $bin2hex = bin2hex(random_bytes(64));
        return md5(microtime() . $bin2hex);
    }

    /**
     * 生成固定长度的字符串,尽力保证唯一性.
     */
    public static function getUniqueIdSha256(): string
    {
        $bin2hex = bin2hex(random_bytes(64));
        return hash('sha256', microtime() . $bin2hex);
    }

    /**
     * 生成UUID字符串.
     */
    public static function getUuid(): string
    {
        return Uuid::uuid4()->toString();
    }
}
