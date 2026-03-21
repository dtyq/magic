<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Constants\SandboxEndpoints;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ImportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response\ImportWorkspaceResponse;
use Exception;
use Hyperf\Logger\LoggerFactory;

/**
 * Workspace importer service implementation.
 * Routes the import request through the sandbox proxy.
 */
class WorkspaceImporterService extends AbstractSandboxOS implements WorkspaceImporterInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SandboxGatewayInterface $gateway,
    ) {
        parent::__construct($loggerFactory);
    }

    /**
     * Import workspace from remote ZIP URL via sandbox proxy.
     */
    public function import(string $sandboxId, ImportWorkspaceRequest $request): ImportWorkspaceResponse
    {
        $this->logger->info('[Sandbox][Workspace] Importing workspace', [
            'sandbox_id' => $sandboxId,
            'url' => $request->getUrl(),
            'target_dir' => $request->getTargetDir(),
        ]);

        try {
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                SandboxEndpoints::WORKSPACE_IMPORT,
                $request->toArray()
            );

            $response = ImportWorkspaceResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Workspace] Workspace imported successfully', [
                    'sandbox_id' => $sandboxId,
                    'url' => $request->getUrl(),
                    'target_dir' => $request->getTargetDir(),
                    'workspace_dir' => $response->getWorkspaceDir(),
                    'extracted_files' => $response->getExtractedFiles(),
                ]);
            } else {
                $this->logger->error('[Sandbox][Workspace] Failed to import workspace', [
                    'sandbox_id' => $sandboxId,
                    'url' => $request->getUrl(),
                    'target_dir' => $request->getTargetDir(),
                    'response_code' => $response->getCode(),
                    'response_message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Workspace] Unexpected error when importing workspace', [
                'sandbox_id' => $sandboxId,
                'url' => $request->getUrl(),
                'target_dir' => $request->getTargetDir(),
                'error' => $e->getMessage(),
            ]);

            return ImportWorkspaceResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}
