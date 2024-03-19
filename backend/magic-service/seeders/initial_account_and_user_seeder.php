<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Seeders\Seeder;
use Hyperf\DbConnection\Db;

class InitialAccountAndUserSeeder extends Seeder
{
    public function run(): void
    {
        // 定义三个指定的账号信息
        $specifiedAccounts = [
            [
                'country_code' => '86',
                'phone' => '13812345678',
                'email' => 'admin@example.com',
                'real_name' => '管理员',
                'gender' => 1, // 男
                'password' => 'letsmagic.ai', // 默认密码
            ],
            [
                'country_code' => '86',
                'phone' => '13912345678',
                'email' => 'user@example.com',
                'real_name' => '普通用户',
                'gender' => 2, // 女
                'password' => 'letsmagic.ai', // 默认密码
            ],
            [
                'country_code' => '86',
                'phone' => '13800138001',
                'email' => 'test@example.com',
                'real_name' => '测试用户',
                'gender' => 1, // 男
                'password' => '123456', // 测试密码
            ],
        ];

        $createdAccountIds = [];
        $allMagicIds = [];

        try {
            // 开启事务
            Db::beginTransaction();

            // 检查并创建指定账号
            foreach ($specifiedAccounts as $accountInfo) {
                // 检查此账号是否存在
                /** @var array $existingAccount */
                $existingAccount = Db::table('magic_contact_accounts')
                    ->where('type', 1)
                    ->where(function ($query) use ($accountInfo) {
                        $query->where('phone', $accountInfo['phone'])
                            ->orWhere('email', $accountInfo['email']);
                    })
                    ->first();

                if ($existingAccount) {
                    echo "账号已存在: {$existingAccount['real_name']}, ID: {$existingAccount['id']}, Magic ID: {$existingAccount['magic_id']}" . PHP_EOL;
                    $allMagicIds[] = $existingAccount['magic_id'];
                } else {
                    // 创建新账号
                    $magicId = IdGenerator::getSnowId();
                    $accountData = [
                        'magic_id' => $magicId,
                        'type' => 1, // 人类账号
                        'status' => 0, // 正常状态
                        'country_code' => $accountInfo['country_code'],
                        'phone' => $accountInfo['phone'],
                        'email' => $accountInfo['email'],
                        'password' => hash('sha256', $accountInfo['password']), // 使用配置的密码
                        'real_name' => $accountInfo['real_name'],
                        'gender' => $accountInfo['gender'],
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ];

                    $accountId = Db::table('magic_contact_accounts')->insertGetId($accountData);
                    echo "已创建新账号: {$accountInfo['real_name']}, ID: {$accountId}, Magic ID: {$magicId}" . PHP_EOL;
                    $createdAccountIds[] = $accountId;
                    $allMagicIds[] = $magicId;
                }
            }

            if (empty($createdAccountIds)) {
                echo '所有指定账号均已存在，无需创建新账号' . PHP_EOL;
            } else {
                echo '已创建 ' . count($createdAccountIds) . ' 个新账号, IDs: ' . implode(', ', $createdAccountIds) . PHP_EOL;
            }

            // 为每个账号创建两个不同组织下的用户
            $organizationCodes = ['test001', 'test002'];

            foreach ($allMagicIds as $index => $magicId) {
                $name = $index === 0 ? '管理员' : '普通用户';

                foreach ($organizationCodes as $orgIndex => $orgCode) {
                    // 检查该组织下是否已有该账号的用户数据
                    $existingUser = Db::table('magic_contact_users')
                        ->where('magic_id', $magicId)
                        ->where('organization_code', $orgCode)
                        ->first();

                    if ($existingUser) {
                        echo "账号 {$magicId} 在组织 {$orgCode} 下已有用户数据，跳过创建" . PHP_EOL;
                        continue;
                    }

                    // 创建用户数据
                    $userId = di(MagicUserRepositoryInterface::class)->getUserIdByType(UserIdType::UserId, $orgCode);
                    $userData = [
                        'magic_id' => $magicId,
                        'organization_code' => $orgCode,
                        'user_id' => $userId,
                        'user_type' => 1, // 人类用户
                        'status' => 1, // 已激活
                        'nickname' => $name . ($orgIndex + 1),
                        'i18n_name' => json_encode(['zh-CN' => $name . ($orgIndex + 1), 'en-US' => ($index === 0 ? 'Admin' : 'User') . ($orgIndex + 1)]),
                        'avatar_url' => '',
                        'description' => '这是' . $name . '的用户账号',
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ];

                    Db::table('magic_contact_users')->insert($userData);
                    echo "已为账号 {$magicId} 在组织 {$orgCode} 下创建用户" . PHP_EOL;
                }
            }

            // 提交事务
            Db::commit();
            echo '账号和用户数据填充完成' . PHP_EOL;
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            // 打印 file line trace
            echo '数据填充失败: ' . $e->getMessage() . PHP_EOL;
            echo 'file: ' . $e->getFile() . PHP_EOL;
            echo 'line: ' . $e->getLine() . PHP_EOL;
            echo 'trace: ' . $e->getTraceAsString() . PHP_EOL;
        }
    }
}
