<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response\ExportWorkspaceResponse;

/**
 * Workspace exporter interface.
 * Defines workspace export functionality via sandbox proxy.
 */
interface WorkspaceExporterInterface
{
    /**
     * Export workspace to object storage.
     *
     * @param string $sandboxId Sandbox ID to route the request through
     * @param ExportWorkspaceRequest $request Export request containing type, code, and upload config
     * @return ExportWorkspaceResponse Response containing file_key and metadata
     */
    public function export(string $sandboxId, ExportWorkspaceRequest $request): ExportWorkspaceResponse;
}
