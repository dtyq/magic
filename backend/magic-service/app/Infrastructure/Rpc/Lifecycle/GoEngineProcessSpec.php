<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class GoEngineProcessSpec
{
    public const string PID_TYPE = 'go';

    /**
     * @param string[] $arguments
     * @param array<string, string> $environment
     */
    private function __construct(
        public string $workDir,
        public string $executable,
        public array $arguments,
        public array $environment,
        public string $socketPath,
    ) {
    }

    /**
     * @param string[] $arguments
     * @param array<string, string> $environment
     */
    public static function structured(
        string $workDir,
        string $executable,
        array $arguments,
        array $environment,
        string $socketPath,
    ): self {
        return new self(
            workDir: $workDir,
            executable: $executable,
            arguments: array_values($arguments),
            environment: $environment,
            socketPath: $socketPath,
        );
    }

    public function canStart(): bool
    {
        return $this->workDir !== '' && $this->executable !== '';
    }

    public function displayCommand(): string
    {
        $prefix = $this->environment['CONFIG_FILE'] ?? '';
        $parts = array_merge([$this->executable], $this->arguments);
        $command = implode(' ', array_map($this->quoteCommandPart(...), $parts));

        if ($prefix === '') {
            return $command;
        }

        return 'CONFIG_FILE=' . $this->quoteCommandPart($prefix) . ' ' . $command;
    }

    /**
     * @return string[]
     */
    public function commandVector(): array
    {
        return array_merge([$this->executable], $this->arguments);
    }

    /**
     * @return array<string, mixed>
     */
    public function toLogContext(): array
    {
        return [
            'pid_type' => self::PID_TYPE,
            'command' => $this->displayCommand(),
            'executable' => $this->executable,
            'arguments' => $this->arguments,
            'workdir' => $this->workDir,
            'socket_path' => $this->socketPath,
            'env_keys' => array_keys($this->environment),
        ];
    }

    private function quoteCommandPart(string $part): string
    {
        if ($part === '') {
            return "''";
        }

        if (preg_match('/^[A-Za-z0-9_\/.=:,@+-]+$/', $part) === 1) {
            return $part;
        }

        return escapeshellarg($part);
    }
}
