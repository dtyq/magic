<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ImportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response\ImportWorkspaceResponse;

/**
 * Workspace importer interface.
 * Defines workspace import functionality via sandbox proxy.
 */
interface WorkspaceImporterInterface
{
    /**
     * Import workspace from remote ZIP URL.
     *
     * @param string $sandboxId Sandbox ID to route the request through
     * @param ImportWorkspaceRequest $request Import request containing URL and target directory
     * @return ImportWorkspaceResponse Response containing imported workspace metadata
     */
    public function import(string $sandboxId, ImportWorkspaceRequest $request): ImportWorkspaceResponse;
}
