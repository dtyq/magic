<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * 密码哈希工具类.
 */
class PasswordHasher
{
    protected string $hashAlgo = PASSWORD_BCRYPT;

    /**
     * 密码哈希选项.
     */
    protected array $hashOptions = [
        'cost' => 10,
    ];

    /**
     * 对密码进行哈希处理.
     *
     * @param string $password 原始密码
     * @return string 哈希后的密码
     */
    public function hash(string $password): string
    {
        return password_hash($password, $this->hashAlgo, $this->hashOptions);
    }

    /**
     * 验证密码是否正确.
     *
     * @param string $password 原始密码
     * @param string $hash 哈希后的密码
     * @return bool 是否验证通过
     */
    public function verify(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    /**
     * 检查密码哈希是否需要重新哈希.
     *
     * @param string $hash 哈希后的密码
     * @return bool 是否需要重新哈希
     */
    public function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, $this->hashAlgo, $this->hashOptions);
    }
}
