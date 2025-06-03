<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\HttpTransportHandler;

use App\Application\Authentication\Service\ApiKeyProviderAppService;
use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
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
    ) {
    }

    public function authenticate(): AuthInfo
    {
        $apiKey = $this->getRequestApiKey();
        if (empty($apiKey)) {
            throw new AuthenticationError('No API key provided');
        }

        $apiKeyProviderEntity = $this->apiKeyProviderAppService->verifySecretKey($apiKey);
        if ($apiKeyProviderEntity->getRelType() !== ApiKeyProviderType::MCP) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'api_key']);
        }

        $authorization = $this->createAuthenticatable($apiKeyProviderEntity);

        return AuthInfo::create($apiKey, ['*'], [
            'authorization' => $authorization,
            'api_key_provider' => $apiKeyProviderEntity,
        ]);
    }

    private function getRequestApiKey(): string
    {
        $apiKey = $this->request->header('authorization', $this->request->input('key', ''));
        if (empty($apiKey)) {
            return '';
        }
        if (str_starts_with($apiKey, 'Bearer ')) {
            $apiKey = substr($apiKey, 7);
        }
        return $apiKey;
    }

    private function createAuthenticatable(ApiKeyProviderEntity $apiKeyProviderEntity): Authenticatable
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId($apiKeyProviderEntity->getCreator());
        $authorization->setOrganizationCode($apiKeyProviderEntity->getOrganizationCode());
        $authorization->setUserType(UserType::Human);
        return $authorization;
    }
}
