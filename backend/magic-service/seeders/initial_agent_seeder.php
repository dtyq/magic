<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Agent\Service\MagicAgentAppService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Database\Seeders\Seeder;
use Hyperf\DbConnection\Db;

class InitialAgentSeeder extends Seeder
{
    public function run(): void
    {
        try {
            // 获取组织内所有用户
            $users = Db::table('magic_contact_users')
                ->where('user_type', 1)
                ->get()
                ->toArray();
            if (empty($users)) {
                echo '没有用户，不执行初始化助理行为';
                return;
            }
            foreach ($users as $user) {
                // 创建用户授权对象
                $authorization = new MagicUserAuthorization();
                $authorization->setId($user['user_id']);
                $authorization->setOrganizationCode($user['organization_code']);

                // 初始化助理
                echo "为用户 {$user['user_id']} 初始化助理...\n";
                try {
                    /** @var MagicAgentAppService $agentService */
                    $agentService = di(MagicAgentAppService::class);
                    $agentService->initAgents($authorization);
                    echo "用户 {$user['user_id']} 助理初始化成功\n";
                } catch (Throwable $e) {
                    echo '初始化助理失败: ' . $e->getMessage() . "\n";
                    echo 'file: ' . $e->getFile() . "\n";
                    echo 'line: ' . $e->getLine() . "\n";
                    // 继续下一个用户，不中断整个流程
                    continue;
                }
            }
            echo "所有组织助理初始化完成\n";
        } catch (Throwable $e) {
            echo '助理初始化过程失败: ' . $e->getMessage() . "\n";
            // 不抛出异常，避免整个种子执行中断
        }
    }
}
