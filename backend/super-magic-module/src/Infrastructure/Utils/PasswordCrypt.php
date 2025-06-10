<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * 可逆密码加密解密工具.
 */
class PasswordCrypt
{
    /**
     * 加密方法.
     *
     * @param string $password 原始密码
     * @return string 加密后的密码
     */
    public static function encrypt(string $password): string
    {
        if (empty($password)) {
            return '';
        }

        // 使用 openssl 加密
        $method = 'AES-256-CBC';
        $key = self::getEncryptKey();
        $iv = substr(hash('sha256', self::getEncryptIv()), 0, 16);

        $encrypted = openssl_encrypt($password, $method, $key, 0, $iv);
        return base64_encode($encrypted);
    }

    /**
     * 解密方法.
     *
     * @param string $encryptedPassword 加密后的密码
     * @return string 解密后的原始密码
     */
    public static function decrypt(string $encryptedPassword): string
    {
        if (empty($encryptedPassword)) {
            return '';
        }

        // 使用 openssl 解密
        $method = 'AES-256-CBC';
        $key = self::getEncryptKey();
        $iv = substr(hash('sha256', self::getEncryptIv()), 0, 16);

        $encrypted = base64_decode($encryptedPassword);
        $result = openssl_decrypt($encrypted, $method, $key, 0, $iv);
        return $result === false ? '' : $result;
    }

    /**
     * 获取加密密钥.
     *
     * @return string 加密密钥
     */
    private static function getEncryptKey(): string
    {
        return config('super-magic.share.encrypt_key');
    }

    /**
     * 获取加密向量.
     *
     * @return string 加密向量
     */
    private static function getEncryptIv(): string
    {
        return config('super-magic.share.encrypt_iv');
    }
}
