<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Service\MagicThirdPlatformDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 聚合当前组织来源与联系人映射，提供通用第三方用户身份。
 */
readonly class ThirdPlatformUserIdAppService
{
    private LoggerInterface $logger;

    /**
     * 注入通用映射、组织来源和日志依赖，不依赖具体企业平台。
     */
    public function __construct(
        private MagicThirdPlatformDomainService $thirdPlatformDomainService,
        private MagicOrganizationEnvDomainService $organizationEnvDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('third_platform_user');
    }

    /**
     * 解析当前组织来源系统中的用户 ID；空字符串表示当前无法确定。
     */
    public function resolveUserId(MagicUserEntity $user, string $organizationCode): string
    {
        if ($user->getOrganizationCode() !== $organizationCode) {
            $this->logger->warning('第三方用户身份解析主体不匹配', ['reason' => 'subject_mismatch']);
            return '';
        }
        if ($user->getMagicId() === '' || $organizationCode === '') {
            return '';
        }

        try {
            $binding = $this->organizationEnvDomainService->getOrganizationEnvironmentByMagicOrganizationCode($organizationCode);
            $environment = $binding === null ? null : $this->organizationEnvDomainService->getMagicEnvironmentById($binding->getEnvironmentId());
            if ($environment === null) {
                $this->logger->debug('第三方用户来源配置缺失', ['reason' => 'source_config_missing']);
                return '';
            }
            $source = $environment->getThirdPlatformType();
            if ($source === null || $source === '' || in_array($source, [PlatformType::None->value, PlatformType::Magic->value], true)) {
                return '';
            }
            $platform = PlatformType::tryFrom($source);
            if ($platform === null || $environment->getId() <= 0) {
                $this->logger->warning('第三方用户来源配置无效', ['reason' => 'source_config_invalid']);
                return '';
            }
            return $this->thirdPlatformDomainService->resolveUserId($environment, $user->getMagicId(), $organizationCode, $platform);
        } catch (Exception $exception) {
            // 可选资料失败不阻断基础资料或沙箱初始化；不记录可能包含凭证的异常正文。
            $this->logger->warning('第三方用户映射查询失败', [
                'reason' => 'mapping_query_failed',
                'exception_type' => $exception::class,
            ]);
            return '';
        }
    }
}
