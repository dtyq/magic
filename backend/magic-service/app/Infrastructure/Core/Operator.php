<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use DateTime;

class Operator extends AbstractValueObject
{
    protected string $uid;

    protected string $name;

    protected DateTime $time;

    public function __construct(?string $uid = '', ?string $name = '', ?DateTime $time = null)
    {
        $this->uid = (string) $uid;
        $this->name = $name;
        $this->time = $time ?: new DateTime('now');
    }

    /**
     * 获取操作者ID.
     */
    public function getUid(): string
    {
        return $this->uid;
    }

    /**
     * 获取操作者名称.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * 获取操作时间.
     */
    public function getTime(): DateTime
    {
        return $this->time;
    }

    /**
     * 设置操作者ID.
     */
    public function setUid(string $uid): self
    {
        $this->uid = $uid;
        return $this;
    }

    /**
     * 设置操作者名称.
     */
    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    /**
     * 设置操作时间.
     */
    public function setTime(DateTime $time): self
    {
        $this->time = $time;
        return $this;
    }

    /**
     * 创建系统用户.
     */
    public static function createSystemUser(): self
    {
        return new self('100', 'SYSTEM');
    }

    /**
     * 创建单元测试用户.
     */
    public static function createUnitUser(): self
    {
        return new self('unit_100', 'UNIT');
    }
}
