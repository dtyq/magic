<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\SSE;

use App\Application\Authentication\Service\ApiKeyProviderAppService;
use App\Application\MCP\Service\MCPServerSSEAppService;
use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\MCP\Server\Handler\MCPHandler;
use App\Infrastructure\Core\MCP\Server\Transport\SSETransport;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\Authenticatable;

class MCPServerSSEApi
{
    public function __construct(
        protected RequestInterface $request,
        protected SSETransport $SSETransport,
        protected ApiKeyProviderAppService $apiKeyProviderAppService,
        protected MCPServerSSEAppService $MCPServerSSEAppService,
    ) {
    }

    public function register(string $code): void
    {
        $apiKey = $this->request->header('authorization', $this->request->input('key', ''));
        if (empty($apiKey)) {
            return;
        }
        if (str_starts_with($apiKey, 'Bearer ')) {
            $apiKey = substr($apiKey, 7);
        }
        $serverName = $this->getServerName($code);
        $authorization = $this->createAuthenticatable($code, $apiKey);

        $handler = make(MCPHandler::class);
        foreach ($this->MCPServerSSEAppService->getTools($authorization, $code) as $tool) {
            $handler->getToolManager()->registerTool($tool);
        }
        $this->SSETransport->register($this->request->getUri()->getPath(), $serverName, $handler);
    }

    public function handle(string $code): void
    {
        $serverName = $this->getServerName($code);
        $sessionId = $this->request->input('sessionId', '');
        $this->SSETransport->handle($serverName, $sessionId, $this->SSETransport->readMessage());
    }

    private function getServerName(string $code): string
    {
        return 'MCP-Server-SSE-' . $code;
    }

    private function createAuthenticatable(string $code, string $apiKey): Authenticatable
    {
        $apiKeyEntity = $this->apiKeyProviderAppService->verifySecretKey($apiKey);
        if ($apiKeyEntity->getRelType() !== ApiKeyProviderType::MCP || $apiKeyEntity->getRelCode() !== $code) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'api_key']);
        }
        $authorization = new MagicUserAuthorization();
        $authorization->setId($apiKeyEntity->getCreator());
        $authorization->setOrganizationCode($apiKeyEntity->getOrganizationCode());
        $authorization->setUserType(UserType::Human);
        return $authorization;
    }
}
