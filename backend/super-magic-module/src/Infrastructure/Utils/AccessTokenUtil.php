<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Hyperf\Context\ApplicationContext;
use Hyperf\Redis\Redis;

/**
 * 临时访问令牌工具类.
 * 基于Redis管理令牌的生命周期和权限.
 */
class AccessTokenUtil
{
    /**
     * Redis键前缀.
     */
    protected static string $prefix = 'super_magic_access_token:';

    /**
     * 默认过期时间(秒).
     */
    protected static int $defaultTtl = 3600;

    /**
     * 生成临时访问令牌.
     *
     * @param string $shareId 分享ID
     * @param string $organizationCode 组织代码
     * @param string $scope 权限范围(如：read, write, full)
     * @param null|int $ttl 过期时间(秒)，不指定则使用默认值
     * @param null|array $metadata 附加元数据
     * @return string 生成的令牌
     */
    public static function generate(string $shareId, string $organizationCode = '', string $scope = 'read', ?int $ttl = null, ?array $metadata = null): string
    {
        $redis = self::getRedis();
        $actualTtl = $ttl ?? self::$defaultTtl;

        // 基于分享ID和作用域生成确定性的令牌 + php时间戳获取
        $token = md5($shareId . ':' . $scope . ':' . $organizationCode . ':' . time());

        // 构建令牌数据
        $tokenData = [
            'share_id' => $shareId,
            'scope' => $scope,
            'created_at' => time(),
            'expires_at' => time() + $actualTtl,
            'metadata' => $metadata ?? [],
            'organization_code' => $organizationCode,
        ];

        // 存储令牌数据
        $key = self::$prefix . $token;
        $redis->set($key, json_encode($tokenData));
        $redis->expire($key, $actualTtl);

        return $token;
    }

    /**
     * 验证令牌有效性.
     *
     * @param string $token 访问令牌
     * @param null|string $requiredScope 所需权限范围
     * @return bool 令牌是否有效
     */
    public static function validate(string $token, ?string $requiredScope = null): bool
    {
        $data = self::getTokenData($token);

        // 令牌不存在
        if (! $data) {
            return false;
        }

        // 令牌已过期
        if (time() > ($data['expires_at'] ?? 0)) {
            self::revoke($token);
            return false;
        }

        // 验证权限范围
        if ($requiredScope && ($data['scope'] ?? '') !== $requiredScope) {
            return false;
        }

        return true;
    }

    /**
     * 撤销令牌.
     *
     * @param string $token 访问令牌
     * @return bool 操作是否成功
     */
    public static function revoke(string $token): bool
    {
        $redis = self::getRedis();
        $tokenKey = self::$prefix . $token;
        return (bool) $redis->del($tokenKey);
    }

    /**
     * 刷新令牌有效期.
     *
     * @param string $token 访问令牌
     * @param null|int $ttl 新的过期时间(秒)，不指定则使用默认值
     * @return bool 操作是否成功
     */
    public static function refresh(string $token, ?int $ttl = null): bool
    {
        $data = self::getTokenData($token);
        if (! $data) {
            return false;
        }

        $data['expires_at'] = time() + ($ttl ?? self::$defaultTtl);

        $key = self::$prefix . $token;
        $redis = self::getRedis();
        $redis->set($key, json_encode($data));
        $redis->expire($key, $ttl ?? self::$defaultTtl);

        return true;
    }

    /**
     * 获取令牌关联的分享ID.
     *
     * @param string $token 访问令牌
     * @return null|string 分享ID，无效令牌返回null
     */
    public static function getShareId(string $token): ?string
    {
        $data = self::getTokenData($token);
        return $data['share_id'] ?? null;
    }

    public static function getOrganizationCode(string $token): ?string
    {
        $data = self::getTokenData($token);
        return $data['organization_code'] ?? null;
    }

    /**
     * 获取令牌元数据.
     *
     * @param string $token 访问令牌
     * @return null|array 令牌元数据，无效令牌返回null
     */
    public static function getMetadata(string $token): ?array
    {
        $data = self::getTokenData($token);
        return $data['metadata'] ?? null;
    }

    /**
     * 从请求中提取令牌.
     *
     * @param array $headers 请求头数组
     * @param array $query 查询参数数组
     * @param array $body 请求体数组
     * @return null|string 提取的令牌，未找到返回null
     */
    public static function extractTokenFromRequest(array $headers = [], array $query = [], array $body = []): ?string
    {
        // 从Authorization头提取
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (is_string($authHeader) && str_starts_with($authHeader, 'Bearer ')) {
            return substr($authHeader, 7);
        }

        // 从查询参数提取
        if (isset($query['access_token']) && is_string($query['access_token'])) {
            return $query['access_token'];
        }

        // 从请求体提取
        if (isset($body['access_token']) && is_string($body['access_token'])) {
            return $body['access_token'];
        }

        return null;
    }

    /**
     * 获取Redis实例.
     */
    protected static function getRedis(): Redis
    {
        return ApplicationContext::getContainer()->get(Redis::class);
    }

    /**
     * 获取令牌数据.
     *
     * @param string $token 访问令牌
     * @return null|array 令牌数据，不存在返回null
     */
    protected static function getTokenData(string $token): ?array
    {
        $redis = self::getRedis();
        $json = $redis->get(self::$prefix . $token);
        if (! $json) {
            return null;
        }

        return json_decode($json, true);
    }

    /**
     * 生成UUID字符串.
     *
     * @return string UUID字符串
     */
    protected static function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xFFFF),
            mt_rand(0, 0xFFFF),
            mt_rand(0, 0xFFFF),
            mt_rand(0, 0x0FFF) | 0x4000,
            mt_rand(0, 0x3FFF) | 0x8000,
            mt_rand(0, 0xFFFF),
            mt_rand(0, 0xFFFF),
            mt_rand(0, 0xFFFF)
        );
    }
}
