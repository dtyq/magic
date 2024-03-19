<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\JWT;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Hyperf\Stringable\Str;

class SimpleJWT
{
    private string $tokenPrefix = 'Bearer';

    private string $key;

    public function __construct(string $key)
    {
        $this->key = $key;
    }

    /**
     * 颁发token.
     */
    public function issueToken(array $data, int $expires = 7200): array
    {
        $token = [
            'iss' => app_name(), // 签发者 可选
            'aud' => '', // 接收该JWT的一方，可选
            'exp' => time() + $expires, // 过期时间
            'data' => $data, // 自定义数据
        ];
        return [
            'access_token' => JWT::encode($token, $this->key, 'HS256'),
            'token_type' => $this->tokenPrefix,
            'expires_in' => $expires,
        ];
    }

    /**
     * 验证token.
     */
    public function authenticate(string $authorization = ''): array
    {
        return $this->certification($this->getClientInfo($authorization));
    }

    private function certification($token = '')
    {
        $res = $this->verification($token);
        return $res['data'] ?? [];
    }

    private function verification(string $jwt)
    {
        if (empty($jwt)) {
            return [];
        }
        $decoded = (array) JWT::decode($jwt, new Key($this->key, 'HS256'));
        return json_decode(json_encode($decoded), true);
    }

    private function getClientInfo(string $authorization = ''): string
    {
        $token = $authorization;
        if (Str::startsWith($authorization, $this->tokenPrefix)) {
            if (preg_match('/' . $this->tokenPrefix . '[\+\s]*(.*)\b/i', $authorization, $matches)) {
                $token = $matches[1] ?? '';
            }
        }
        return $token;
    }
}
