<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Entity\ValueObject;

use InvalidArgumentException;

/**
 * 分享代码值对象
 * 表示一个唯一的分享标识符.
 */
class ShareCode
{
    /**
     * 分享代码最小长度.
     */
    private const int MIN_LENGTH = 6;

    /**
     * 分享代码最大长度.
     */
    private const int MAX_LENGTH = 16;

    /**
     * 分享代码值
     */
    private string $value;

    /**
     * 构造函数.
     *
     * @param string $value 分享代码值
     * @throws InvalidArgumentException 当分享代码不合法时抛出异常
     */
    public function __construct(string $value)
    {
        $this->validate($value);
        $this->value = $value;
    }

    /**
     * 转换为字符串.
     */
    public function __toString(): string
    {
        return $this->value;
    }

    /**
     * 创建新的分享代码实例.
     *
     * @param string $value 分享代码值
     */
    public static function create(string $value): self
    {
        return new self($value);
    }

    /**
     * 获取分享代码值
     */
    public function getValue(): string
    {
        return $this->value;
    }

    /**
     * 判断是否等于另一个分享代码
     *
     * @param ShareCode $other 另一个分享代码
     */
    public function equals(ShareCode $other): bool
    {
        return $this->value === $other->value;
    }

    /**
     * 验证分享代码
     *
     * @param string $value 分享代码值
     * @throws InvalidArgumentException 当分享代码不合法时抛出异常
     */
    private function validate(string $value): void
    {
        // 检查长度
        $length = mb_strlen($value);
        if ($length < self::MIN_LENGTH || $length > self::MAX_LENGTH) {
            throw new InvalidArgumentException(
                sprintf('分享代码长度必须在%d到%d个字符之间', self::MIN_LENGTH, self::MAX_LENGTH)
            );
        }

        // 检查格式（只允许字母、数字和部分特殊字符）
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $value)) {
            throw new InvalidArgumentException('分享代码只能包含字母、数字、下划线和连字符');
        }
    }
}
