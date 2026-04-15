<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc;

class ClientConfig
{
    public function __construct(
        public readonly int $protocolVersion = 1,
        public readonly string $authToken = '',
        public readonly string $clientId = '',
        public readonly int $maxMessageBytes = 10 * 1024 * 1024,
        public readonly float $readTimeout = 30.0,
        public readonly float $writeTimeout = 10.0,
        public readonly float $heartbeatInterval = 10.0,
        public readonly float $heartbeatTimeout = 30.0,
        public readonly int $maxPendingRequests = 1024,
        public readonly int $discardCapMultiplier = 4,
        public readonly int $discardChunkSize = 32768,
        public readonly float $discardTimeout = 0.0,
        public readonly int $oversizeMaxBurst = 0
    ) {
    }

    public static function fromArray(array $config): self
    {
        return new self(
            protocolVersion: (int) ($config['protocol_version'] ?? 1),
            authToken: (string) ($config['auth_token'] ?? ''),
            clientId: (string) ($config['client_id'] ?? ''),
            maxMessageBytes: (int) ($config['max_message_bytes'] ?? 10 * 1024 * 1024),
            readTimeout: (float) ($config['read_timeout'] ?? 30.0),
            writeTimeout: (float) ($config['write_timeout'] ?? 10.0),
            heartbeatInterval: (float) ($config['heartbeat_interval'] ?? 10.0),
            heartbeatTimeout: (float) ($config['heartbeat_timeout'] ?? 30.0),
            maxPendingRequests: (int) ($config['max_pending_requests'] ?? 1024),
            discardCapMultiplier: (int) ($config['discard_cap_multiplier'] ?? 4),
            discardChunkSize: (int) ($config['discard_chunk_size'] ?? 32768),
            discardTimeout: (float) ($config['discard_timeout'] ?? 0.0),
            oversizeMaxBurst: (int) ($config['oversize_max_burst'] ?? 0)
        );
    }
}
