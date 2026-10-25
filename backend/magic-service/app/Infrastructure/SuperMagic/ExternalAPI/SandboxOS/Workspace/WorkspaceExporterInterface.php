<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Response\ExportWorkspaceResponse;

/**
 * Workspace exporter interface.
 * Defines workspace export functionality via sandbox proxy.
 */
interface WorkspaceExporterInterface
{
    /**
     * Export workspace to object storage.
     *
     * @param DataIsolation $dataIsolation per-call user identity (forwarded to in-pod agent)
     * @param string $sandboxId Sandbox ID to route the request through
     * @param ExportWorkspaceRequest $request Export request containing type, code, and upload config
     * @return ExportWorkspaceResponse Response containing file_key and metadata
     */
    public function export(DataIsolation $dataIsolation, string $sandboxId, ExportWorkspaceRequest $request): ExportWorkspaceResponse;

    /** 创建异步工作区导出任务。 */
    public function createAsync(DataIsolation $dataIsolation, string $sandboxId, ExportWorkspaceRequest $request, string $taskKey): ExportWorkspaceResponse;

    /** 查询异步工作区导出任务。 */
    public function checkAsync(DataIsolation $dataIsolation, string $sandboxId, string $taskKey): ExportWorkspaceResponse;
}
