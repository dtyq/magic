<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\TempAuth;

use Hyperf\Codec\Json;
use Hyperf\Redis\Redis;
use Hyperf\Redis\RedisFactory;
use Hyperf\Stringable\Str;
use RuntimeException;
use Throwable;

class RedisTempAuth implements TempAuthInterface
{
    protected Redis $redis;

    protected string $keyPrefix = 'magic:temp_auth:';

    protected string $prefix = 'TEMP_AUTH';

    public function __construct(
        RedisFactory $redisFactory,
    ) {
        $this->redis = $redisFactory->get('default');
    }

    /**
     * Check if a specific authentication code exists.
     * This is a utility method not defined in the interface.
     *
     * @param string $code Authentication code to check
     * @return bool True if the code exists, false otherwise
     */
    public function has(string $code): bool
    {
        $key = $this->getRedisKey($code);

        try {
            return (int) $this->redis->exists($key) > 0;
        } catch (Throwable $e) {
            throw new RuntimeException('Failed to check temp auth code existence: ' . $e->getMessage());
        }
    }

    /**
     * Create a temporary authentication code with the given info and TTL.
     *
     * @param array $info Information to store with the code
     * @param int $ttl Time to live in seconds (default: 60)
     * @return string Generated authentication code
     */
    public function create(array $info, int $ttl = 60): string
    {
        $code = $this->generateCode();
        $key = $this->getRedisKey($code);

        try {
            $this->redis->setex($key, $ttl, Json::encode($info));
            return $code;
        } catch (Throwable $e) {
            throw new RuntimeException('Failed to create temp auth code: ' . $e->getMessage());
        }
    }

    /**
     * Get information associated with the given code.
     *
     * @param string $code Authentication code
     * @return array Information associated with the code
     * @throws RuntimeException If code doesn't exist or has expired
     */
    public function get(string $code): array
    {
        $key = $this->getRedisKey($code);

        try {
            $data = $this->redis->get($key);

            if ($data === null || $data === false) {
                throw new RuntimeException('Temp auth code not found or has expired');
            }

            return Json::decode($data);
        } catch (Throwable $e) {
            if (str_contains($e->getMessage(), 'not found or has expired')) {
                throw $e;
            }
            throw new RuntimeException('Failed to retrieve temp auth code: ' . $e->getMessage());
        }
    }

    /**
     * Delete the given authentication code.
     *
     * @param string $code Authentication code to delete
     */
    public function delete(string $code): void
    {
        $key = $this->getRedisKey($code);

        try {
            $this->redis->del($key);
        } catch (Throwable $e) {
            throw new RuntimeException('Failed to delete temp auth code: ' . $e->getMessage());
        }
    }

    public function is(string $code): bool
    {
        return str_starts_with($code, $this->prefix);
    }

    /**
     * Generate a unique authentication code.
     *
     * @return string Generated code
     */
    protected function generateCode(): string
    {
        return $this->prefix . '-' . Str::random(32);
    }

    /**
     * Get the Redis key for the given code.
     *
     * @param string $code Authentication code
     * @return string Redis key
     */
    protected function getRedisKey(string $code): string
    {
        return $this->keyPrefix . $code;
    }
}
