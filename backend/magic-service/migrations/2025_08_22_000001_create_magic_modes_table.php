<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

use function Hyperf\Support\now;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_modes')) {
            return;
        }

        Schema::create('magic_modes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->json('name_i18n')->comment('模式名称国际化');
            $table->string('identifier', 50)->default('')->comment('模式标识，唯一');
            $table->string('icon', 255)->default('')->comment('模式图标');
            $table->string('color', 10)->default('')->comment('模式颜色');
            $table->bigInteger('sort')->default(0)->comment('排序');
            $table->text('description')->comment('模式描述');
            $table->tinyInteger('is_default')->default(0)->comment('是否默认模式 0:否 1:是');
            $table->tinyInteger('status')->default(1)->comment('状态 0:禁用 1:启用');
            $table->tinyInteger('distribution_type')->default(1)->comment('分配方式 1:自定义配置 2:跟随其他模式');
            $table->bigInteger('follow_mode_id')->unsigned()->default(0)->comment('跟随的模式ID，0表示不跟随');
            $table->json('restricted_mode_identifiers')->comment('限制的模式标识数组');
            $table->string('organization_code', 32)->default('')->comment('组织代码');
            $table->string('creator_id', 64)->default('')->comment('创建人ID');
            $table->timestamps();
            $table->softDeletes();

            // 添加唯一索引
            $table->unique('identifier', 'idx_identifier');
        });

        // 插入默认模式数据
        $this->insertDefaultModeData();
    }

    /**
     * 插入默认模式数据.
     */
    private function insertDefaultModeData(): void
    {
        $defaultModeData = [
            'id' => IdGenerator::getSnowId(),
            'name_i18n' => json_encode([
                'zh_CN' => '默认模式',
                'en_US' => 'Default Mode',
            ]),
            'identifier' => 'default',
            'icon' => '',
            'sort' => 0,
            'color' => '#6366f1',
            'description' => '仅用于创建时初始化模式及重置模式中的配置',
            'is_default' => 1,
            'status' => 1,
            'distribution_type' => 1, // 独立配置
            'follow_mode_id' => 0,
            'restricted_mode_identifiers' => json_encode([]),
            'organization_code' => '',
            'creator_id' => '',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        Db::table('magic_modes')->insert($defaultModeData);
    }
};
