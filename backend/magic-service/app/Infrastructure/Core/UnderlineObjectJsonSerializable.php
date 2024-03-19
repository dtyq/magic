<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use App\Infrastructure\Core\Traits\MagicCacheTrait;
use DateTime;
use Hyperf\Codec\Exception\InvalidArgumentException;
use Hyperf\Codec\Json;
use Hyperf\Contract\Arrayable;
use JsonSerializable;
use Throwable;

abstract class UnderlineObjectJsonSerializable implements JsonSerializable, Arrayable
{
    use MagicCacheTrait;

    public function jsonSerialize(): array
    {
        $json = [];
        /* @phpstan-ignore-next-line */
        foreach ($this as $key => $value) {
            $key = $this->getUnCamelizeValueFromCache($key);
            if ($value instanceof DateTime) {
                $value = $value->format('Y-m-d H:i:s');
            }
            $json[$key] = $value;
        }
        return $json;
    }

    /**
     * 获取类的属性，不包括动态属性.
     */
    public function toArray(): array
    {
        return Json::decode($this->toJsonString());
    }

    public function toJsonString(): string
    {
        // 避免调用 toArray 方法调用本方法时，再调用 hyperf 的 Json::encode 方法造成死循环
        try {
            $json = json_encode($this, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            throw new InvalidArgumentException($exception->getMessage(), (int) $exception->getCode(), $exception);
        }
        return $json;
    }
}
