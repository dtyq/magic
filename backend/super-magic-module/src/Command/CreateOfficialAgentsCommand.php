<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Command;

use App\Application\Agent\Official\OfficialAgentsInitializer;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CreateOfficialAgentsCommand extends HyperfCommand
{
    protected ?string $name = 'super-magic:create-official-agents';

    protected LoggerInterface $logger;

    public function __construct(
        protected MagicUserDomainService $magicUserDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('create-official-agents');
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('创建官方员工（Agent）');
        $this->addOption('user_id', null, InputOption::VALUE_REQUIRED, '归属用户ID');
    }

    public function handle(): void
    {
        $userId = $this->input->getOption('user_id');

        $this->line('🚀 开始创建官方员工...');
        $this->logger->info('开始创建官方员工', ['user_id' => $userId]);

        try {
            // 1. 检查用户是否存在
            $this->line('📋 检查用户是否存在...');
            $this->logger->info('检查用户是否存在', ['user_id' => $userId]);
            $userEntity = $this->magicUserDomainService->getByUserId($userId);
            if ($userEntity === null) {
                $this->error("❌ 用户不存在: {$userId}");
                $this->logger->error('用户不存在', ['user_id' => $userId]);
                return;
            }
            $this->line("✅ 用户存在: {$userId} ({$userEntity->getNickname()})");
            $this->logger->info('用户存在', [
                'user_id' => $userId,
                'nickname' => $userEntity->getNickname(),
                'organization_code' => $userEntity->getOrganizationCode(),
            ]);

            // 2. 检查用户是否是官方组织下的用户
            $this->line('📋 检查用户是否属于官方组织...');
            $this->logger->info('检查用户是否属于官方组织', [
                'user_id' => $userId,
                'organization_code' => $userEntity->getOrganizationCode(),
            ]);

            $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
            if (empty($officialOrganizationCode)) {
                $this->error('❌ 官方组织编码未配置');
                $this->logger->error('官方组织编码未配置');
                return;
            }

            $userOrganizations = $this->magicUserDomainService->getUserOrganizations($userId);
            $isOfficialUser = false;
            foreach ($userOrganizations as $orgCode) {
                if (OfficialOrganizationUtil::isOfficialOrganization($orgCode)) {
                    $isOfficialUser = true;
                    break;
                }
            }

            if (! $isOfficialUser) {
                $this->error("❌ 用户不属于官方组织: {$userId}");
                $this->logger->error('用户不属于官方组织', [
                    'user_id' => $userId,
                    'user_organizations' => $userOrganizations,
                    'official_organization_code' => $officialOrganizationCode,
                ]);
                return;
            }
            $this->line("✅ 用户属于官方组织: {$officialOrganizationCode}");
            $this->logger->info('用户属于官方组织', [
                'user_id' => $userId,
                'official_organization_code' => $officialOrganizationCode,
            ]);

            // 3. 批量创建官方员工
            $this->line('📋 开始批量创建官方员工...');
            $this->logger->info('开始批量创建官方员工', ['organization_code' => $officialOrganizationCode, 'user_id' => $userId]);

            $result = OfficialAgentsInitializer::init($userId, []);

            if (($result['success'] ?? false) !== true) {
                $this->error('❌ ' . ($result['message'] ?? '创建失败'));
                $this->logger->error('创建失败', ['result' => $result]);
                return;
            }

            $successCount = $result['success_count'];
            $skipCount = $result['skip_count'];
            $failCount = $result['fail_count'];
            $results = $result['results'] ?? [];

            // 6. 输出结果摘要
            $this->line('');
            $this->line('📊 创建结果摘要:');
            $this->line("  ✅ 成功: {$successCount}");
            $this->line("  ⚠️  跳过: {$skipCount}");
            $this->line("  ❌ 失败: {$failCount}");
            $this->logger->info('创建完成', [
                'success_count' => $successCount,
                'skip_count' => $skipCount,
                'fail_count' => $failCount,
                'results' => $results,
            ]);

            if ($successCount > 0) {
                $this->line('');
                $this->line('✅ 成功创建的员工:');
                foreach ($results as $result) {
                    if ($result['status'] === 'success') {
                        $this->line("  - {$result['code']} (ID: {$result['agent_id']})");
                    }
                }
            }

            if ($skipCount > 0) {
                $this->line('');
                $this->line('⚠️  跳过的员工:');
                foreach ($results as $result) {
                    if ($result['status'] === 'skipped') {
                        $this->line("  - {$result['code']}: {$result['reason']}");
                    }
                }
            }

            if ($failCount > 0) {
                $this->line('');
                $this->line('❌ 创建失败的员工:');
                foreach ($results as $result) {
                    if ($result['status'] === 'failed') {
                        $this->line("  - {$result['code']}: {$result['error']}");
                    }
                }
            }

            $this->line('');
            $this->line('🎉 命令执行完成！');
        } catch (Throwable $e) {
            $this->error("❌ 命令执行失败: {$e->getMessage()}");
            $this->logger->error('命令执行失败', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
