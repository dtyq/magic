<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Official;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayOfficialApp;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\ModelGateway\Service\ApplicationDomainService;
use Ramsey\Uuid\Uuid;
use Throwable;

/**
 * Official Access Token Initializer.
 * Initialize official application and access token with optional custom api-key.
 */
class OfficialAccessTokenInitializer
{
    private const string DEFAULT_ORG_CODE = 'DT001';

    /**
     * Initialize official access token with optional custom api-key.
     * @param null|string $apiKey Custom api-key, if null will generate one
     * @return array{success: bool, message: string, access_token: null|string, application_code: null|string}
     */
    public static function init(?string $apiKey = null): array
    {
        try {
            // Get organization code from config, fallback to default
            $orgCode = config('service_provider.office_organization', self::DEFAULT_ORG_CODE);

            $llmDataIsolation = new LLMDataIsolation($orgCode, 'system');

            // Step 1: Check or create application
            $applicationDomainService = di(ApplicationDomainService::class);
            $application = $applicationDomainService->getByCodeWithNull($llmDataIsolation, ModelGatewayOfficialApp::APP_CODE);

            if (! $application) {
                $application = new ApplicationEntity();
                $application->setCode(ModelGatewayOfficialApp::APP_CODE);
                $application->setName('灯塔引擎');
                $application->setDescription('灯塔引擎官方应用');
                $application->setOrganizationCode($orgCode);
                $application->setCreator('system');
                $application = $applicationDomainService->save($llmDataIsolation, $application);
            }

            // Step 2: Check or create access token
            $accessTokenDomainService = di(AccessTokenDomainService::class);
            $accessToken = $accessTokenDomainService->getByName($llmDataIsolation, $application->getCode());

            $isNewToken = false;
            if (! $accessToken) {
                $isNewToken = true;
                $accessToken = new AccessTokenEntity();
                $accessToken->setName($application->getCode());
                $accessToken->setType(AccessTokenType::Application);
                $accessToken->setRelationId((string) $application->getId());
                $accessToken->setOrganizationCode($orgCode);
                $accessToken->setModels(['all']);
                $accessToken->setCreator('system');

                // Set custom api-key or generate one
                if ($apiKey !== null && $apiKey !== '') {
                    $accessToken->setAccessToken($apiKey);
                } else {
                    $accessToken->setAccessToken(self::generateApiKey());
                }

                $accessToken = $accessTokenDomainService->save($llmDataIsolation, $accessToken);
            }

            return [
                'success' => true,
                'message' => $isNewToken
                    ? 'Successfully created official application and access token.'
                    : 'Official application and access token already exist.',
                'access_token' => $accessToken->getAccessToken(),
                'application_code' => $application->getCode(),
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Failed to initialize access token: ' . $e->getMessage(),
                'access_token' => null,
                'application_code' => null,
            ];
        }
    }

    /**
     * Generate a random API key.
     */
    private static function generateApiKey(): string
    {
        return 'mgc_' . str_replace('-', '', Uuid::uuid4()->toString());
    }
}
