<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command\Flow;

use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\MysqlStringCache;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use Exception;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\Redis\RedisFactory;
use Hyperf\Redis\RedisProxy;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

#[Command]
class CacheRedisToMysqlCommand extends HyperfCommand
{
    private const string REDIS_KEY_PREFIX = 'MagicFlowStringCache';

    private const int BATCH_SIZE = 100;

    private LoggerInterface $logger;

    private RedisProxy $redis;

    private MysqlStringCache $mysqlStringCache;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('flow-cache:redis-to-mysql');
        $this->logger = $container->get(LoggerFactory::class)->get('CacheRedisToMysqlCommand');
        $this->redis = $container->get(RedisFactory::class)->get('default');
        $this->mysqlStringCache = $container->get(MysqlStringCache::class);
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Migrate all cache from Redis to MySQL');
        $this->addOption('dry-run', null, null, 'Show what would be migrated without actually migrating');
    }

    public function handle(): int
    {
        $dryRun = $this->input->getOption('dry-run');

        $this->line('Starting Redis to MySQL cache migration...', 'info');
        $this->line('Dry run mode: ' . ($dryRun ? 'YES' : 'NO'), 'info');

        try {
            $cursor = 0;
            $totalFound = 0;
            $totalMigrated = 0;
            $totalErrors = 0;
            $maxIterations = 10000; // Safety limit to prevent infinite loops
            $currentIteration = 0;

            do {
                if (++$currentIteration > $maxIterations) {
                    $this->line("Reached maximum iterations limit ({$maxIterations}), stopping for safety", 'error');
                    break;
                }
                // Use cursor-based SCAN for better performance
                // Account for Redis prefix configuration (magic:)
                $scanPattern = 'magic:' . self::REDIS_KEY_PREFIX . ':*';
                $result = $this->redis->rawCommand('SCAN', $cursor, 'MATCH', $scanPattern, 'COUNT', self::BATCH_SIZE);

                $this->line("Scanning with pattern: {$scanPattern}", 'comment');

                if (! is_array($result) || count($result) < 2) {
                    $this->line('Invalid SCAN result format', 'error');
                    $this->logger->error('ScanResultFormatError', [
                        'result' => $result,
                        'cursor' => $cursor,
                    ]);
                    break;
                }

                [$nextCursor, $keys] = $result;
                $cursor = (int) $nextCursor;

                $this->line("Cursor: {$cursor}, Found: " . count($keys) . ' keys in this batch', 'comment');

                if (! empty($keys)) {
                    $this->line('Processing batch with ' . count($keys) . ' keys...', 'comment');

                    foreach ($keys as $redisKey) {
                        ++$totalFound;

                        try {
                            // Get TTL for the key
                            $ttl = $this->redis->ttl($redisKey);

                            // Parse Redis key to extract prefix and key
                            $parsedKey = $this->parseRedisKey($redisKey);
                            if (! $parsedKey) {
                                $this->line("Failed to parse Redis key: {$redisKey}", 'error');
                                ++$totalErrors;
                                continue;
                            }

                            // Get value from Redis
                            $value = $this->redis->get($redisKey);
                            if ($value === null || $value === false) {
                                $this->line("Failed to get value for Redis key: {$redisKey}", 'error');
                                ++$totalErrors;
                                continue;
                            }

                            // Unserialize PHP serialized data
                            $decodedValue = $this->decodeValue($value);
                            if ($decodedValue === null) {
                                $this->line("Failed to decode value for Redis key: {$redisKey}", 'error');
                                ++$totalErrors;
                                continue;
                            }

                            $ttlDescription = $ttl === -1 ? 'permanent' : "{$ttl}s";
                            $this->line("Found cache: {$redisKey} (TTL: {$ttlDescription})", 'comment');

                            // Show decoded value preview
                            $valuePreview = strlen($decodedValue) > 100 ? substr($decodedValue, 0, 100) . '...' : $decodedValue;
                            $this->line("  Decoded value: {$valuePreview}", 'comment');

                            if (! $dryRun) {
                                // Create flow data isolation with system organization and user
                                $dataIsolation = FlowDataIsolation::create('system', 'system');

                                // Migrate to MySQL using MysqlStringCache with actual TTL
                                $success = $this->mysqlStringCache->set(
                                    $dataIsolation,
                                    $parsedKey['prefix'],
                                    $parsedKey['key'],
                                    $decodedValue, // Use decoded value
                                    $ttl // Use actual TTL from Redis
                                );

                                if ($success) {
                                    $this->line("✓ Migrated: {$parsedKey['prefix']}:{$parsedKey['key']}", 'info');
                                    ++$totalMigrated;
                                } else {
                                    $this->line("✗ Failed to migrate: {$parsedKey['prefix']}:{$parsedKey['key']}", 'error');
                                    ++$totalErrors;
                                }
                            } else {
                                $this->line("Would migrate: {$parsedKey['prefix']}:{$parsedKey['key']}", 'info');
                                ++$totalMigrated;
                            }
                        } catch (Exception $e) {
                            $this->line("Error processing key {$redisKey}: " . $e->getMessage(), 'error');
                            $this->logger->error('CacheRedisToMysqlMigrationError', [
                                'redis_key' => $redisKey,
                                'error' => $e->getMessage(),
                                'trace' => $e->getTraceAsString(),
                            ]);
                            ++$totalErrors;
                        }
                    }
                }
            } while ($cursor != 0);

            // Summary
            $this->line('', 'info');
            $this->line('Migration Summary:', 'info');
            $this->line("Total keys found: {$totalFound}", 'info');
            $this->line('Caches ' . ($dryRun ? 'to migrate' : 'migrated') . ": {$totalMigrated}", 'info');
            $this->line("Errors: {$totalErrors}", $totalErrors > 0 ? 'error' : 'info');

            if ($dryRun) {
                $this->line('', 'comment');
                $this->line('This was a dry run. Use without --dry-run to perform actual migration.', 'comment');
            }

            return 0;
        } catch (Exception $e) {
            $this->line('Migration failed: ' . $e->getMessage(), 'error');
            $this->logger->error('CacheRedisToMysqlCommandFailed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return 1;
        }
    }

    /**
     * Parse Redis key to extract prefix and key components.
     * Expected format: magic:MagicFlowStringCache:{prefix}:{key}.
     *
     * @return null|array{prefix: string, key: string}
     */
    private function parseRedisKey(string $redisKey): ?array
    {
        // Expected pattern: magic:MagicFlowStringCache:{prefix}:{key}
        $expectedPrefix = 'magic:' . self::REDIS_KEY_PREFIX . ':';
        if (! str_starts_with($redisKey, $expectedPrefix)) {
            $this->line("Key format mismatch: {$redisKey}", 'error');
            $this->line("Expected prefix: {$expectedPrefix}", 'error');
            return null;
        }

        $keyPart = substr($redisKey, strlen($expectedPrefix));
        $parts = explode(':', $keyPart, 2);

        if (count($parts) < 2) {
            $this->line("Insufficient key parts: {$keyPart}", 'error');
            return null;
        }

        return [
            'prefix' => $parts[0],
            'key' => $parts[1],
        ];
    }

    /**
     * Decode value from Redis cache.
     * Handles PHP serialized data and returns string representation.
     *
     * @param string $value Raw value from Redis
     * @return null|string Decoded value or null on failure
     */
    private function decodeValue(string $value): ?string
    {
        try {
            // Try to unserialize PHP serialized data
            $unserialized = @unserialize($value);

            if ($unserialized !== false || $value === serialize(false)) {
                // Successfully unserialized, convert to string representation
                if (is_string($unserialized)) {
                    return $unserialized;
                }
                if (is_array($unserialized) || is_object($unserialized)) {
                    return json_encode($unserialized, JSON_UNESCAPED_UNICODE);
                }
                if (is_bool($unserialized)) {
                    return $unserialized ? 'true' : 'false';
                }
                if (is_null($unserialized)) {
                    return 'null';
                }
                return (string) $unserialized;
            }
            // Not serialized data, return as is
            return $value;
        } catch (Exception $e) {
            $this->logger->error('DecodeValueFailed', [
                'value' => substr($value, 0, 200), // Log first 200 chars
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
