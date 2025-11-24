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
use App\Domain\ModelGateway\Entity\ValueObject\SystemAccessTokenManager;
use App\Domain\ModelGateway\Service\ApplicationDomainService;

class MagicAccessToken
{
    public static function init(): void
    {
        if (defined('MAGIC_ACCESS_TOKEN')) {
            return;
        }

        $llmDataIsolation = new LLMDataIsolation('', 'system');
        $llmDataIsolation->setCurrentOrganizationCode($llmDataIsolation->getOfficialOrganizationCode());

        // 检查应用是否已经创建
        $applicationDomainService = di(ApplicationDomainService::class);
        $application = $applicationDomainService->getByCodeWithNull($llmDataIsolation, ModelGatewayOfficialApp::APP_CODE);
        if (! $application) {
            $application = new ApplicationEntity();
            $application->setCode(ModelGatewayOfficialApp::APP_CODE);
            $application->setName('灯塔引擎');
            $application->setDescription('灯塔引擎官方应用');
            $application->setOrganizationCode($llmDataIsolation->getCurrentOrganizationCode());
            $application->setCreator('system');
            $application = $applicationDomainService->save($llmDataIsolation, $application);
        }

        // 这里的常量 AccessToken 不落库，仅存在于内存中，保证内部调用时使用一致
        $accessToken = new AccessTokenEntity();
        $accessToken->setId(1);
        $accessToken->setName($application->getCode());
        $accessToken->setType(AccessTokenType::Application);
        $accessToken->setRelationId((string) $application->getId());
        $accessToken->setOrganizationCode($llmDataIsolation->getCurrentOrganizationCode());
        $accessToken->setModels(['all']);
        $accessToken->setCreator('system');
        $accessToken->prepareForCreation();
        SystemAccessTokenManager::setSystemAccessToken($accessToken);

        // 新增官方组织个人访问令牌常量
        $userAccessToken = new AccessTokenEntity();
        $userAccessToken->setId(2);
        $userAccessToken->setName($application->getCode());
        $userAccessToken->setType(AccessTokenType::User);
        $userAccessToken->setRelationId('system');
        $userAccessToken->setOrganizationCode($llmDataIsolation->getOfficialOrganizationCode());
        $userAccessToken->setModels(['all']);
        $userAccessToken->setCreator('system');
        $userAccessToken->prepareForCreation();
        SystemAccessTokenManager::setSystemAccessToken($userAccessToken);

        define('MAGIC_ACCESS_TOKEN', $accessToken->getPlaintextAccessToken());
        define('MAGIC_OFFICIAL_ACCESS_TOKEN', $userAccessToken->getPlaintextAccessToken());
    }
}
