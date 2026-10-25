<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Core\Traits;

use App\Infrastructure\Core\Traits\MagicCacheTrait;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class MagicCacheTraitTest extends TestCase
{
    public function testConvertsNamesWithoutContainer(): void
    {
        // 未初始化 ApplicationContext：旧实现依赖容器创建缓存驱动，会抛 TypeError
        $subject = new class {
            use MagicCacheTrait;

            public function un(string $key): string
            {
                return $this->getUnCamelizeValueFromCache($key);
            }

            public function camel(string $key): string
            {
                return $this->getCamelizeValueFromCache($key);
            }
        };

        self::assertSame('user_name', $subject->un('userName'));
        self::assertSame('userName', $subject->camel('user_name'));
        // 重复调用（命中缓存）结果一致
        self::assertSame('user_name', $subject->un('userName'));
        self::assertSame('userName', $subject->camel('user_name'));
    }
}
