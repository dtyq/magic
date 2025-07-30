<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Service;

use App\Domain\Agent\Constant\MagicAgentReleaseStatus;
use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Repository\Persistence\MagicAgentRepository;
use App\Domain\Agent\Repository\Persistence\MagicAgentVersionRepository;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Domain\Flow\Repository\Facade\MagicFlowVersionRepositoryInterface;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 助理 service.
 */
class MagicAgentVersionDomainService
{
    public function __construct(
        public MagicAgentVersionRepository $agentVersionRepository,
        public MagicAgentRepository $agentRepository,
        public MagicUserRepository $magicUserRepository,
        public MagicFlowVersionRepositoryInterface $magicFlowVersionRepository
    ) {
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function getAgentsByOrganization(string $organizationCode, array $agentIds, int $page, int $pageSize, string $agentName, ?string $descriptionKeyword = null): array
    {
        return $this->agentVersionRepository->getAgentsByOrganization($organizationCode, $agentIds, $page, $pageSize, $agentName, $descriptionKeyword);
    }

    public function getAgentsByOrganizationCount(string $organizationCode, array $agentIds, string $agentName): int
    {
        return $this->agentVersionRepository->getAgentsByOrganizationCount($organizationCode, $agentIds, $agentName);
    }

    /**
     * 优化版本：直接获取启用的助理版本，避免传入大量ID.
     * @return MagicAgentVersionEntity[]
     */
    public function getEnabledAgentsByOrganization(string $organizationCode, int $page, int $pageSize, string $agentName): array
    {
        return $this->agentVersionRepository->getEnabledAgentsByOrganization($organizationCode, $page, $pageSize, $agentName);
    }

    /**
     * 优化版本：获取启用助理的总数.
     */
    public function getEnabledAgentsByOrganizationCount(string $organizationCode, string $agentName): int
    {
        return $this->agentVersionRepository->getEnabledAgentsByOrganizationCount($organizationCode, $agentName);
    }

    public function getAgentsFromMarketplace(array $agentIds, int $page, int $pageSize): array
    {
        return $this->agentVersionRepository->getAgentsFromMarketplace($agentIds, $page, $pageSize);
    }

    public function getAgentsFromMarketplaceCount(array $agentIds): int
    {
        return $this->agentVersionRepository->getAgentsFromMarketplaceCount($agentIds);
    }

    /**
     * 发布版本.
     */
    public function releaseAgentVersion(MagicAgentVersionEntity $magicAgentVersionEntity): array
    {
        // 审批开关 todo
        $approvalOpen = false;
        $reviewOpen = false;

        $msg = '';
        // 如果旧状态已经是企业或者市场，则不允许回退
        $oldMagicAgentVersionEntity = $this->agentVersionRepository->getNewestAgentVersionEntity($magicAgentVersionEntity->getAgentId());
        if ($oldMagicAgentVersionEntity !== null) {
            $this->validateVersionNumber($magicAgentVersionEntity->getVersionNumber(), $oldMagicAgentVersionEntity->getVersionNumber());
            $this->validateReleaseScope($magicAgentVersionEntity->getReleaseScope(), $oldMagicAgentVersionEntity->getReleaseScope());
        }

        if ($magicAgentVersionEntity->getReleaseScope() === MagicAgentReleaseStatus::PERSONAL_USE->value) {
            // 个人使用
            $msg = '发布成功';
        } elseif ($magicAgentVersionEntity->getReleaseScope() === MagicAgentReleaseStatus::PUBLISHED_TO_ENTERPRISE->value) {
            // 发布到企业内部
            /* @phpstan-ignore-next-line */
            if ($approvalOpen) {
                $magicAgentVersionEntity->setApprovalStatus(MagicAgentVersionStatus::APPROVAL_PENDING->value);
                $magicAgentVersionEntity->setEnterpriseReleaseStatus(MagicAgentVersionStatus::APP_MARKET_LISTED->value);
                $msg = '提交成功';
            } else {
                $magicAgentVersionEntity->setEnterpriseReleaseStatus(MagicAgentVersionStatus::ENTERPRISE_PUBLISHED->value);
            }
            $msg = '发布成功';
        } elseif ($magicAgentVersionEntity->getReleaseScope() === MagicAgentReleaseStatus::PUBLISHED_TO_MARKET->value) {
            // 发布到应用市场
            // 审核开关
            /* @phpstan-ignore-next-line */
            if ($reviewOpen) {
            } else {
                $magicAgentVersionEntity->setAppMarketStatus(MagicAgentVersionStatus::APP_MARKET_LISTED->value);
            }
        }

        $magicAgentVersionEntity = $this->agentVersionRepository->insert($magicAgentVersionEntity);

        return ['msg' => $msg, 'data' => $magicAgentVersionEntity];
    }

    public function getAgentById(string $id): MagicAgentVersionEntity
    {
        return $this->agentVersionRepository->getAgentById($id);
    }

    /**
     * 根据ids获取助理版本.
     * @return array<MagicAgentVersionEntity>
     */
    public function getAgentByIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }
        return $this->agentVersionRepository->getAgentByIds($ids);
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function getReleaseAgentVersions(string $agentId): array
    {
        return $this->agentVersionRepository->getReleaseAgentVersions($agentId);
    }

    public function enableAgentVersionById(string $id): bool
    {
        $agent = $this->agentVersionRepository->getAgentById($id);

        $approvalOpen = false;

        // 审批开关
        /* @phpstan-ignore-next-line */
        if ($approvalOpen) {
            // 校验状态
            if ($agent->getApprovalStatus() !== MagicAgentVersionStatus::APPROVAL_PASSED->value) {
                ExceptionBuilder::throw(AgentErrorCode::VERSION_CAN_ONLY_BE_ENABLED_AFTER_APPROVAL);
            }
        }

        $this->agentVersionRepository->setEnterpriseStatus($id, MagicAgentVersionStatus::ENTERPRISE_ENABLED->value);

        return true;
    }

    public function disableAgentVersion($id): bool
    {
        $agent = $this->agentVersionRepository->getAgentById($id);

        if ($agent->getEnterpriseReleaseStatus() !== MagicAgentVersionStatus::ENTERPRISE_ENABLED->value) {
            ExceptionBuilder::throw(AgentErrorCode::VERSION_ONLY_ENABLED_CAN_BE_DISABLED);
        }

        $this->agentVersionRepository->setEnterpriseStatus($id, MagicAgentVersionStatus::ENTERPRISE_DISABLED->value);

        return true;
    }

    public function getAgentMaxVersion(string $agentId): string
    {
        // 返回的是语义化版本，需要在返回的基础上+1
        $agentMaxVersion = $this->agentVersionRepository->getAgentMaxVersion($agentId);
        // 如果版本号是整数格式（如 1），将其转换为语义化版本号（如 1.0.0）
        if (is_numeric($agentMaxVersion) && strpos($agentMaxVersion, '.') === false) {
            $agentMaxVersion = $agentMaxVersion . '.0.0';
        }

        // 解析版本号，例如 "0.0.1" => ['0', '0', '1']
        [$major, $minor, $patch] = explode('.', $agentMaxVersion);

        // 将 PATCH 部分加 1
        $patch = (int) $patch + 1;

        // 如果 PATCH 达到 10，进位到 MINOR（可以根据需求调整此规则）
        if ($patch > 99) {
            $patch = 0;
            $minor = (int) $minor + 1;
        }

        // 如果 MINOR 达到 10，进位到 MAJOR（可以根据需求调整此规则）
        if ($minor > 99) {
            // 不重置minor，而是直接增大major，避免不必要的重置
            $minor = 0;
            $major = (int) $major + 1;
        }

        // 拼接并返回新的版本号
        return "{$major}.{$minor}.{$patch}";
    }

    /**
     * 根据助理 id 获取默认的版本.
     */
    public function getDefaultVersions(array $agentIds): void
    {
        $this->agentVersionRepository->getDefaultVersions($agentIds);
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function listAgentVersionsByIds(array $agentVersionIds): array
    {
        return $this->agentVersionRepository->listAgentVersionsByIds($agentVersionIds);
    }

    public function getById(string $agentVersionId): MagicAgentVersionEntity
    {
        return $this->agentVersionRepository->getAgentById($agentVersionId);
    }

    public function updateAgentEnterpriseStatus(string $agentVersionId, int $status): void
    {
        $this->agentVersionRepository->updateAgentEnterpriseStatus($agentVersionId, $status);
    }

    public function getAgentByFlowCode(string $flowCode): ?MagicAgentVersionEntity
    {
        return $this->agentVersionRepository->getAgentByFlowCode($flowCode);
    }

    /**
     * 基于游标分页获取指定组织的助理版本列表.
     * @param string $organizationCode 组织代码
     * @param array $agentVersionIds 助理版本ID列表
     * @param string $cursor 游标ID，如果为空字符串则从最新开始
     * @param int $pageSize 每页数量
     * @return array<MagicAgentVersionEntity>
     */
    public function getAgentsByOrganizationWithCursor(string $organizationCode, array $agentVersionIds, string $cursor, int $pageSize): array
    {
        $res = $this->agentVersionRepository->getAgentsByOrganizationWithCursor($organizationCode, $agentVersionIds, $cursor, $pageSize);
        return array_map(fn ($item) => new MagicAgentVersionEntity($item), $res);
    }

    /**
     * 验证新版本号是否合法.
     * @throws BusinessException
     */
    private function validateVersionNumber(string $newVersion, string $oldVersion): void
    {
        if (version_compare($newVersion, $oldVersion, '<=')) {
            ExceptionBuilder::throw(
                AgentErrorCode::VALIDATE_FAILED,
                'agent.newly_published_version_number_cannot_be_same_as_previous_version_and_cannot_be_less_than_max_version_number'
            );
        }
    }

    /**
     * 验证发布范围是否合法.
     */
    private function validateReleaseScope(int $newScope, int $oldScope): void
    {
        if ($newScope >= $oldScope) {
            return;
        }

        // 检查是否试图从更高级别的发布范围回退到更低级别
        $errorMessage = match ($oldScope) {
            MagicAgentReleaseStatus::PUBLISHED_TO_ENTERPRISE->value => 'agent.already_published_to_enterprise_cannot_publish_to_individual',
            MagicAgentReleaseStatus::PUBLISHED_TO_MARKET->value => 'agent.already_published_to_market_cannot_publish_to_individual',
            default => null,
        };

        if ($errorMessage !== null) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, $errorMessage);
        }
    }
}
