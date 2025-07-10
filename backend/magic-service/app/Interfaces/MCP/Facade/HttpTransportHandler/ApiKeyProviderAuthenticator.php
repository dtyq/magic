<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\HttpTransportHandler;

use App\Application\Authentication\Service\ApiKeyProviderAppService;
use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\PhpMcp\Shared\Auth\AuthenticatorInterface;
use Dtyq\PhpMcp\Shared\Exceptions\AuthenticationError;
use Dtyq\PhpMcp\Types\Auth\AuthInfo;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\Authenticatable;

class ApiKeyProviderAuthenticator implements AuthenticatorInterface
{
    public function __construct(
        protected RequestInterface $request,
        protected ApiKeyProviderAppService $apiKeyProviderAppService,
        protected TempAuthInterface $tempAuth,
    ) {
    }

    public function authenticate(string $server, string $version): AuthInfo
    {
        $apiKey = $this->getRequestApiKey();
        if (empty($apiKey)) {
            throw new AuthenticationError('No API key provided');
        }

        if ($this->tempAuth->is($apiKey)) {
            $data = $this->tempAuth->get($apiKey);
            if (empty($data['organization_code']) || empty($data['user_id']) || empty($data['server_code'])) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'api_key']);
            }
            $authorization = $this->createAuthenticatable($data['organization_code'], $data['user_id']);
            $serverCode = $data['server_code'];
        } else {
            $apiKeyProviderEntity = $this->apiKeyProviderAppService->verifySecretKey($apiKey);
            if ($apiKeyProviderEntity->getRelType() !== ApiKeyProviderType::MCP) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'api_key']);
            }
            $authorization = $this->createAuthenticatable($apiKeyProviderEntity->getOrganizationCode(), $apiKeyProviderEntity->getCreator());
            $serverCode = $apiKeyProviderEntity->getRelCode();
        }

        return AuthInfo::create($apiKey, ['*'], [
            'authorization' => $authorization,
            'server_code' => $serverCode,
        ]);
    }

    private function getRequestApiKey(): string
    {
        $apiKey = $this->request->header('authorization', $this->request->input('key', ''));
        if (empty($apiKey)) {
            return '';
        }

        // Remove Bearer prefix (case-insensitive) and trim any extra spaces
        // Handle multiple Bearer prefixes by repeatedly removing them
        $apiKey = trim($apiKey);
        $iterations = 0;
        while (preg_match('/^bearer\s+(.+)$/i', $apiKey, $matches) && $iterations < 10) {
            $apiKey = trim($matches[1]);
            ++$iterations;
        }

        return $apiKey;
    }

    private function createAuthenticatable($organizationCode, string $operator): Authenticatable
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId($operator);
        $authorization->setOrganizationCode($organizationCode);
        $authorization->setUserType(UserType::Human);
        return $authorization;
    }
}
