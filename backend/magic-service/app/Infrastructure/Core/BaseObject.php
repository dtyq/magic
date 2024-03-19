<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use ArrayAccess;
use Hyperf\Contract\Arrayable;

/**
 * 快速属性访问基类
 * 其他类可继承此类，获得便捷的属性设置和访问能力.
 */
abstract class BaseObject extends UnderlineObjectJsonSerializable implements ArrayAccess, Arrayable
{
    public function __get(string $key): mixed
    {
        return $this->get($key);
    }

    public function __set(string $key, mixed $value): void
    {
        $this->set($key, $value);
    }

    public function __isset(string $key): bool
    {
        return $this->offsetExists($key);
    }

    public function offsetGet($offset): mixed
    {
        return $this->get($offset);
    }

    public function offsetSet($offset, $value): void
    {
        $this->set($offset, $value);
    }

    public function offsetExists($offset): bool
    {
        return $this->get($offset) !== null;
    }

    public function offsetUnset($offset): void
    {
        $this->set($offset, null);
    }

    protected function initProperty(array $data): void
    {
        foreach ($data as $key => $value) {
            $this->set($key, $value);
        }
    }

    protected function get(string $key): mixed
    {
        // 属性一定要是小驼峰！不支持其他格式！
        $humpKey = $this->getCamelizeValueFromCache($key);
        // 判断属性是否存在，避免调用不存在的属性时，死循环触发 __get 方法
        if (! property_exists($this, $humpKey)) {
            return null;
        }
        // php 的方法不区分大小写
        $methodName = 'get' . $humpKey;
        if (method_exists($this, $methodName)) {
            return $this->{$methodName}($humpKey);
        }
        return $this->{$humpKey};
    }

    protected function set(string $key, mixed $value): void
    {
        // 属性一定要是小驼峰！不支持其他格式！
        $humpKey = $this->getCamelizeValueFromCache($key);
        // 判断属性是否存在，避免调用不存在的属性时，死循环触发 __set 方法
        if (! property_exists($this, $humpKey)) {
            return;
        }
        // php 的方法不区分大小写
        $methodName = 'set' . $humpKey;
        if (method_exists($this, $methodName)) {
            $this->{$methodName}($value);
            return;
        }
        $this->{$humpKey} = $value;
    }
}
