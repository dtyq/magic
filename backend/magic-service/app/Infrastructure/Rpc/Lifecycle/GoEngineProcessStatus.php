<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class GoEngineProcessStatus
{
    public function __construct(
        public bool $running,
        public ?int $pid,
        public int $exitCode,
        public bool $signaled,
        public ?int $termSignal,
        public bool $stopped,
        public ?int $stopSignal,
    ) {
    }

    /**
     * @param array<string, mixed> $status
     */
    public static function fromProcStatus(array $status): self
    {
        $pid = (int) ($status['pid'] ?? 0);

        return new self(
            running: (bool) ($status['running'] ?? false),
            pid: $pid > 0 ? $pid : null,
            exitCode: (int) ($status['exitcode'] ?? -1),
            signaled: (bool) ($status['signaled'] ?? false),
            termSignal: self::positiveSignalOrNull($status['termsig'] ?? null),
            stopped: (bool) ($status['stopped'] ?? false),
            stopSignal: self::positiveSignalOrNull($status['stopsig'] ?? null),
        );
    }

    private static function positiveSignalOrNull(mixed $value): ?int
    {
        $signal = (int) ($value ?? 0);
        return $signal > 0 ? $signal : null;
    }
}
