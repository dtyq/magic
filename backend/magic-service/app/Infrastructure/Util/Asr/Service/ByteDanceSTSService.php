<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Asr\Service;

use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Exception;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\Redis\RedisFactory;
use Psr\Log\LoggerInterface;

/**
 * 字节跳动语音服务STS令牌服务
 * 用于获取语音服务的JWT token.
 */
class ByteDanceSTSService
{
    /** 服务端请求JWT token的API端点 */
    private const string STS_TOKEN_URL = 'https://openspeech.bytedance.com/api/v1/sts/token';

    /** JWT Token缓存前缀 */
    private const string JWT_CACHE_PREFIX = 'asr:jwt_token:';

    /** 日志记录器 */
    protected LoggerInterface $logger;

    /** HTTP客户端 */
    private Client $client;

    /** Redis客户端 */
    private Redis $redis;

    public function __construct()
    {
        $this->client = new Client();
        $container = ApplicationContext::getContainer();
        $this->logger = $container->get(LoggerFactory::class)->get(static::class);
        $this->redis = $container->get(RedisFactory::class)->get('default');
    }

    /**
     * 根据用户Magic ID获取JWT Token（带缓存）.
     *
     * @param string $magicId 用户Magic ID
     * @param int $duration 有效期（秒），默认7200秒
     * @param bool $refresh 是否强制刷新token，默认false
     * @return array 包含JWT Token和相关信息的数组
     * @throws Exception
     */
    public function getJwtTokenForUser(string $magicId, int $duration = 7200, bool $refresh = false): array
    {
        if (empty($magicId)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidMagicId, 'asr.config_error.invalid_magic_id');
        }

        // 检查缓存（如果不是强制刷新）
        $cacheKey = $this->getCacheKey($magicId);
        if (! $refresh) {
            $cachedData = $this->getCachedJwtToken($cacheKey);

            if ($cachedData !== null) {
                // 计算剩余有效时间
                $remainingDuration = $cachedData['expires_at'] - time();
                $cachedData['duration'] = max(0, $remainingDuration);

                $this->logger->info('返回缓存的JWT Token', [
                    'magic_id' => $magicId,
                    'cache_expires_at' => $cachedData['expires_at'],
                    'remaining_duration' => $remainingDuration,
                ]);
                return $cachedData;
            }
        }

        // 缓存中没有或已过期，或者强制刷新，获取新的JWT Token
        $appId = config('asr.volcengine.app_id');
        $accessToken = config('asr.volcengine.token');

        if (empty($appId) || empty($accessToken)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, 'asr.config_error.invalid_config');
        }

        $jwtToken = $this->getJwtToken($appId, $accessToken, $duration);

        // 构建返回数据
        $tokenData = [
            'jwt_token' => $jwtToken,
            'app_id' => $appId,
            'duration' => $duration,
            'expires_at' => time() + $duration,
            'resource_id' => 'volc.bigasr.sauc.duration',
            'magic_id' => $magicId,
        ];

        // 缓存JWT Token，提前30秒过期以避免边界问题
        $cacheExpiry = max(1, $duration - 30);
        $this->cacheJwtToken($cacheKey, $tokenData, $cacheExpiry);

        $this->logger->info('生成并缓存新的JWT Token', [
            'magic_id' => $magicId,
            'duration' => $duration,
            'cache_expiry' => $cacheExpiry,
            'refresh' => $refresh,
        ]);

        return $tokenData;
    }

    /**
     * 获取JWT token.
     *
     * @param string $appId 应用ID
     * @param string $accessToken 访问令牌
     * @param int $duration 有效期（秒），默认7200秒
     * @return string JWT token
     * @throws Exception
     */
    public function getJwtToken(string $appId, string $accessToken, int $duration = 7200): string
    {
        if (empty($appId) || empty($accessToken)) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, 'asr.config_error.invalid_config');
        }

        $body = [
            'appid' => $appId,
            'duration' => $duration,
        ];

        $headers = [
            'Authorization' => 'Bearer; ' . $accessToken,
            'Content-Type' => 'application/json',
        ];

        try {
            $this->logger->info('请求JWT token', [
                'appid' => $appId,
                'duration' => $duration,
            ]);

            $response = $this->client->post(self::STS_TOKEN_URL, [
                'headers' => $headers,
                'json' => $body,
            ]);

            $responseBody = $response->getBody()->getContents();
            $responseData = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('解析响应JSON失败', [
                    'response' => $responseBody,
                    'error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.sts_token.parse_response_failed');
            }

            if (! isset($responseData['jwt_token'])) {
                $this->logger->error('响应中缺少jwt_token字段', [
                    'response' => $responseData,
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.sts_token.missing_jwt_token');
            }

            $jwtToken = $responseData['jwt_token'];

            $this->logger->info('成功获取JWT token', [
                'appid' => $appId,
                'token_length' => strlen($jwtToken),
            ]);

            return $jwtToken;
        } catch (GuzzleException $e) {
            $this->logger->error('获取JWT token失败', [
                'appid' => $appId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.sts_token.request_failed');
        }
    }

    /**
     * 使用环境变量配置获取JWT token.
     *
     * @param int $duration 有效期（秒），默认7200秒
     * @return string JWT token
     * @throws Exception
     */
    public function getJwtTokenFromConfig(int $duration = 7200): string
    {
        $appId = config('asr.volcengine.app_id');
        $accessToken = config('asr.volcengine.token');

        if (empty($appId) || empty($accessToken)) {
            $this->logger->error('ASR配置不完整', [
                'app_id_exists' => ! empty($appId),
                'access_token_exists' => ! empty($accessToken),
            ]);
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, 'asr.config_error.invalid_config');
        }

        return $this->getJwtToken($appId, $accessToken, $duration);
    }

    /**
     * 清除用户的JWT Token缓存.
     *
     * @param string $magicId 用户Magic ID
     * @return bool 是否成功清除
     */
    public function clearUserJwtTokenCache(string $magicId): bool
    {
        try {
            $cacheKey = $this->getCacheKey($magicId);
            $result = $this->redis->del($cacheKey);

            $this->logger->info('清除用户JWT Token缓存', [
                'magic_id' => $magicId,
                'result' => $result,
            ]);

            return is_int($result) && $result > 0;
        } catch (Exception $e) {
            $this->logger->error('清除JWT Token缓存失败', [
                'magic_id' => $magicId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 生成缓存键.
     *
     * @param string $magicId 用户Magic ID
     * @return string 缓存键
     */
    private function getCacheKey(string $magicId): string
    {
        return self::JWT_CACHE_PREFIX . md5($magicId);
    }

    /**
     * 从缓存获取JWT Token.
     *
     * @param string $cacheKey 缓存键
     * @return null|array 缓存的数据或null
     */
    private function getCachedJwtToken(string $cacheKey): ?array
    {
        try {
            $cachedData = $this->redis->get($cacheKey);

            if ($cachedData === null || $cachedData === false) {
                return null;
            }

            $data = Json::decode($cachedData);

            // 检查是否已过期（额外的安全检查）
            if (isset($data['expires_at']) && $data['expires_at'] <= time()) {
                $this->redis->del($cacheKey);
                return null;
            }

            return $data;
        } catch (Exception $e) {
            $this->logger->warning('获取缓存JWT Token失败', [
                'cache_key' => $cacheKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 缓存JWT Token.
     *
     * @param string $cacheKey 缓存键
     * @param array $tokenData Token数据
     * @param int $expiry 过期时间（秒）
     */
    private function cacheJwtToken(string $cacheKey, array $tokenData, int $expiry): void
    {
        try {
            $this->redis->setex($cacheKey, $expiry, Json::encode($tokenData));
        } catch (Exception $e) {
            $this->logger->warning('缓存JWT Token失败', [
                'cache_key' => $cacheKey,
                'expiry' => $expiry,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
