<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use RuntimeException;

/**
 * MCP 授权敏感字段加解密适配器。
 */
class MCPAuthorizationSecretCipher
{
    /**
     * 加密敏感字段，落库前调用。
     */
    public function encrypt(string $value): string
    {
        if ($value === '') {
            return '';
        }
        $key = $this->getKey();
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($ciphertext === false) {
            throw new RuntimeException('MCP authorization encryption failed');
        }
        return 'v2:' . base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * 解密敏感字段，仅在服务端运行时调用。
     */
    public function decrypt(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        if (! str_starts_with($value, 'v2:')) {
            return '';
        }
        $payload = base64_decode(substr($value, 3), true);
        if ($payload === false || strlen($payload) < 28) {
            return '';
        }
        $plaintext = openssl_decrypt(
            substr($payload, 28),
            'aes-256-gcm',
            $this->getKey(),
            OPENSSL_RAW_DATA,
            substr($payload, 0, 12),
            substr($payload, 12, 16)
        );
        return $plaintext === false ? '' : $plaintext;
    }

    /**
     * 获取 MCP Authorization 专用密钥；未配置时回退到现有共享密钥。
     */
    private function getKey(): string
    {
        $key = (string) config('mcp_authorization.encryption_key', '');
        if ($key === '') {
            $key = (string) config('super-magic.share.encrypt_key', '');
        }
        if ($key === '') {
            throw new RuntimeException('MCP authorization encryption key is not configured');
        }
        return hash('sha256', $key, true);
    }
}
