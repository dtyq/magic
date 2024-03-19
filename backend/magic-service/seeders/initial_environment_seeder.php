<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\DeploymentEnum;
use Hyperf\Database\Seeders\Seeder;
use Hyperf\DbConnection\Db;

class InitialEnvironmentSeeder extends Seeder
{
    public function run(): void
    {
        $envId = 10000;

        // 检查是否已有环境数据
        $existingEnvironment = Db::table('magic_environments')->where('id', $envId)->first();

        if ($existingEnvironment) {
            echo "已存在ID为{$envId}的环境配置数据，无需重复创建" . PHP_EOL;
            return;
        }

        // 生产环境配置
        $productionConfig = [
            'id' => $envId,
            'environment_code' => '',
            'deployment' => DeploymentEnum::OpenSource->value,
            'environment' => 'production',
            'open_platform_config' => '{}',
            'private_config' => json_encode([
                'name' => '麦吉开源',
                'domain' => [
                    [
                        'type' => PlatformType::Magic, // token 由麦吉下发，麦吉自己校验即可
                    ],
                ],
            ], JSON_THROW_ON_ERROR),
            'extra' => null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        // 插入环境配置数据
        Db::table('magic_environments')->insert($productionConfig);

        echo "已创建环境配置: 生产环境 ID {$envId}" . PHP_EOL;
    }
}
