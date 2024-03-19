<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject;

use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStreamableHttpServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\NoneServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ServiceConfigInterface;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\SSEServiceConfig;

enum ServiceType: string
{
    // 麦吉提供的 mcp 服务
    case SSE = 'sse';
    case STDIO = 'stdio';

    // 外部提供的 mcp 服务
    case ExternalSSE = 'external_sse';
    case ExternalStreamableHttp = 'external_http';
    case ExternalStdio = 'external_stdio';

    public function canCheckStatus(): bool
    {
        return in_array($this, [self::ExternalSSE, self::ExternalStreamableHttp], true);
    }

    public function getLabel(): string
    {
        return match ($this) {
            self::SSE => 'SSE',
            self::STDIO => 'STDIO',
            self::ExternalSSE => 'EXTERNAL_SSE',
            self::ExternalStreamableHttp => 'EXTERNAL_STREAMABLE_HTTP',
            self::ExternalStdio => 'EXTERNAL_STDIO',
        };
    }

    public function createServiceConfig(array $serviceConfig): ServiceConfigInterface
    {
        if (isset($serviceConfig['oauth2config'])) {
            $serviceConfig['oauth2_config'] = $serviceConfig['oauth2config'];
        }
        return match ($this) {
            self::SSE => SSEServiceConfig::fromArray($serviceConfig),
            self::ExternalSSE => ExternalSSEServiceConfig::fromArray($serviceConfig),
            self::ExternalStreamableHttp => ExternalStreamableHttpServiceConfig::fromArray($serviceConfig),
            self::ExternalStdio => ExternalStdioServiceConfig::fromArray($serviceConfig),
            default => NoneServiceConfig::fromArray($serviceConfig),
        };
    }
}
