<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class IpcBootstrapConfig
{
    public function __construct(
        public bool $rpcClientEnabled,
        public bool $autoStart,
        public string $socketPath,
        public string $workDir,
        public string $command,
        public GoEngineProcessSpec $processSpec,
        public int $waitTimeoutSeconds,
        public int $waitIntervalMs,
        public bool $supervisorEnabled,
        public int $supervisorIntervalSeconds,
        public int $supervisorRpcUnhealthySeconds,
        public int $supervisorRestartBackoffMs,
        public int $supervisorRestartMaxBackoffMs,
        public int $supervisorTerminateGraceSeconds,
    ) {
    }

    public static function fromArray(array $config): self
    {
        $restartBackoffMs = max(1, (int) ($config['engine_supervisor_restart_backoff_ms'] ?? 1000));
        $restartMaxBackoffMs = max(1, (int) ($config['engine_supervisor_restart_max_backoff_ms'] ?? 30000));
        if ($restartMaxBackoffMs < $restartBackoffMs) {
            $restartMaxBackoffMs = $restartBackoffMs;
        }

        $socketPath = (string) ($config['socket_path'] ?? '');
        $workDir = (string) ($config['engine_workdir'] ?? '');
        $processSpec = self::createProcessSpec($config, $workDir, $socketPath);

        return new self(
            rpcClientEnabled: (bool) ($config['rpc_client_enabled'] ?? true),
            autoStart: (bool) ($config['engine_auto_start'] ?? true),
            socketPath: $socketPath,
            workDir: $processSpec->workDir,
            command: $processSpec->displayCommand(),
            processSpec: $processSpec,
            waitTimeoutSeconds: max(0, (int) ($config['engine_start_wait_timeout_seconds'] ?? 20)),
            waitIntervalMs: max(10, (int) ($config['engine_start_wait_interval_ms'] ?? 200)),
            supervisorEnabled: (bool) ($config['engine_supervisor_enabled'] ?? true),
            supervisorIntervalSeconds: max(1, (int) ($config['engine_supervisor_interval_seconds'] ?? 2)),
            supervisorRpcUnhealthySeconds: max(0, (int) ($config['engine_supervisor_rpc_unhealthy_seconds'] ?? 30)),
            supervisorRestartBackoffMs: $restartBackoffMs,
            supervisorRestartMaxBackoffMs: $restartMaxBackoffMs,
            supervisorTerminateGraceSeconds: max(0, (int) ($config['engine_supervisor_terminate_grace_seconds'] ?? 5)),
        );
    }

    public function canStartProcess(): bool
    {
        return $this->processSpec->canStart();
    }

    public function hasSocketPath(): bool
    {
        return $this->socketPath !== '';
    }

    public function shouldRunSupervisor(): bool
    {
        return $this->rpcClientEnabled
            && $this->autoStart
            && $this->supervisorEnabled
            && $this->canStartProcess();
    }

    /**
     * @param array<string, mixed> $config
     */
    private static function createProcessSpec(array $config, string $workDir, string $socketPath): GoEngineProcessSpec
    {
        $environment = self::normalizeStringMap($config['engine_env'] ?? []);
        $configFile = trim((string) ($config['engine_config_file'] ?? './magic-go-engine-config.yaml'));
        if ($configFile !== '') {
            $environment['CONFIG_FILE'] = $configFile;
        }

        return GoEngineProcessSpec::structured(
            workDir: $workDir,
            executable: (string) ($config['engine_executable'] ?? './bin/magic-go-engine'),
            arguments: self::normalizeStringList($config['engine_arguments'] ?? []),
            environment: $environment,
            socketPath: $socketPath,
        );
    }

    /**
     * @return string[]
     */
    private static function normalizeStringList(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($value)) {
            return [];
        }

        $result = [];
        foreach ($value as $item) {
            if (is_scalar($item)) {
                $result[] = (string) $item;
            }
        }

        return $result;
    }

    /**
     * @return array<string, string>
     */
    private static function normalizeStringMap(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($value)) {
            return [];
        }

        $result = [];
        foreach ($value as $key => $item) {
            if (is_string($key) && is_scalar($item)) {
                $result[$key] = (string) $item;
            }
        }

        return $result;
    }
}
