<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace MagicTestSupport\VideoTesting;

use Hyperf\Contract\ConfigInterface;
use stdClass;

trait UsesDatabaseIsolation
{
    /**
     * @var array<string, mixed>
     */
    private array $isolatedConfigSnapshots = [];

    private ?stdClass $isolatedConfigMissingMarker = null;

    protected function beginDatabaseIsolation(): void
    {
        $this->isolatedConfigSnapshots = [];
        $this->isolatedConfigMissingMarker = new stdClass();
    }

    protected function endDatabaseIsolation(): void
    {
        $this->restoreIsolatedConfigs();
    }

    protected function setIsolatedConfig(string $key, mixed $value): void
    {
        $config = di(ConfigInterface::class);
        if (! array_key_exists($key, $this->isolatedConfigSnapshots)) {
            $this->isolatedConfigSnapshots[$key] = $config->get($key, $this->isolatedConfigMissingMarker);
        }

        $config->set($key, $value);
    }

    /**
     * @param class-string $modelClass
     * @param array<string, mixed> $conditions
     */
    protected function trackModelAbsenceAfterRollback(string $modelClass, array $conditions): void
    {
        // 保留兼容方法；视频测试已切换到固定 test provider/model，不再依赖事务回滚做数据库清理。
    }

    /**
     * @param array<string, mixed> $conditions
     */
    protected function trackTableAbsenceAfterRollback(string $table, array $conditions): void
    {
        // 保留兼容方法；视频测试已切换到固定 test provider/model，不再依赖事务回滚做数据库清理。
    }

    private function restoreIsolatedConfigs(): void
    {
        $config = di(ConfigInterface::class);
        foreach ($this->isolatedConfigSnapshots as $key => $value) {
            $config->set($key, $value === $this->isolatedConfigMissingMarker ? null : $value);
        }

        $this->isolatedConfigSnapshots = [];
        $this->isolatedConfigMissingMarker = null;
    }
}
