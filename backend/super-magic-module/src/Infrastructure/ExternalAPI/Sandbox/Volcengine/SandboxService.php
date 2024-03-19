<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\AbstractSandbox;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxStruct;

class SandboxService extends AbstractSandbox
{
    public function create(SandboxStruct $struct): SandboxResult
    {
        $result = $this->request('POST', 'sandboxes', [
            'json' => $struct->toArray(),
        ]);

        $this->logger->info(sprintf(
            '[Sandbox] Create sandbox result - success: %s, message: %s, data: %s, sandbox_id: %s',
            $result->isSuccess() ? 'true' : 'false',
            $result->getMessage(),
            json_encode($result->getSandboxData()->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $result->getSandboxData()->getSandboxId() ?? 'null'
        ));

        return $result;
    }

    /**
     * 检查沙箱是否存在.
     *
     * 返回格式：
     * {
     *    "code": 1000,
     *    "message": "success",
     *    "data": {
     *        "sandbox_id": "be9ae617",
     *        "status": "running/exited",
     *        "created_at": 1744293391.8599138,
     *        "ip_address": "192.168.148.10"
     *    }
     * }
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxResult 沙箱结果
     */
    public function checkSandboxExists(string $sandboxId): SandboxResult
    {
        $this->logger->info(sprintf(
            '[Sandbox] Check sandbox exists, sandbox_id: %s',
            $sandboxId
        ));

        $result = $this->request('GET', sprintf('sandboxes/%s', $sandboxId));

        // SandboxData 结构体已经确保了所有必要的字段都存在，不需要额外检查

        $this->logger->info(sprintf(
            '[Sandbox] Check sandbox result - success: %s, message: %s, data: %s, code: %d, sandbox_id: %s',
            $result->isSuccess() ? 'true' : 'false',
            $result->getMessage(),
            json_encode($result->getSandboxData()->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $result->getCode(),
            $result->getSandboxData()->getSandboxId() ?? 'null'
        ));

        return $result;
    }

    public function getStatus(string $sandboxId): SandboxResult
    {
        $this->logger->info(sprintf(
            '[Sandbox] Getting sandbox status, sandbox_id: %s',
            $sandboxId
        ));

        $result = $this->request('GET', sprintf('sandboxes/%s', $sandboxId));

        $this->logger->info(sprintf(
            '[Sandbox] Get sandbox status result - success: %s, message: %s, data: %s, sandbox_id: %s',
            $result->isSuccess() ? 'true' : 'false',
            $result->getMessage(),
            json_encode($result->getSandboxData()->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $result->getSandboxData()->getSandboxId() ?? 'null'
        ));

        return $result;
    }

    public function destroy(string $sandboxId): SandboxResult
    {
        $this->logger->info(sprintf(
            '[Sandbox] Destroying sandbox, sandbox_id: %s',
            $sandboxId
        ));

        $result = $this->request('DELETE', sprintf('sandboxes/%s', $sandboxId));

        $this->logger->info(sprintf(
            '[Sandbox] Destroy sandbox result - success: %s, message: %s, data: %s, sandbox_id: %s',
            $result->isSuccess() ? 'true' : 'false',
            $result->getMessage(),
            json_encode($result->getSandboxData()->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $result->getSandboxData()->getSandboxId() ?? 'null'
        ));

        return $result;
    }

    public function getWebsocketUrl(string $sandboxId): string
    {
        $wsHost = str_replace('http://', 'ws://', rtrim($this->baseUrl, '/'));
        if ($this->enableSandbox) {
            $wsUrl = sprintf('%s/sandboxes/ws/%s', $wsHost, $sandboxId);
        } else {
            $wsUrl = sprintf('%s/ws', $wsHost);
        }

        $this->logger->info(sprintf(
            '[Sandbox] Generated WebSocket URL - sandbox_id: %s, base_url: %s, ws_url: %s',
            $sandboxId,
            $this->baseUrl,
            $wsUrl
        ));

        return $wsUrl;
    }
}
