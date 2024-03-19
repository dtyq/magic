<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class UpdateIndexesAndComments extends Migration
{
    public function up(): void
    {
        // 清空 magic_api_premium_endpoint_statistics 表数据
        Db::table('magic_api_premium_endpoint_statistics')->truncate();

        // 修改 magic_api_premium_endpoint_statistics 表的 statistics_level 注释
        Schema::table('magic_api_premium_endpoint_statistics', function (Blueprint $table) {
            $table->integer('statistics_level')->comment('统计级别：0-秒级，1-分钟级，2-小时级，3-天级')->change();
            // 修改 statistics_time 的数据类型为 datetime
            $table->dateTime('statistics_time')->change();
        });

        // 修改 magic_api_premium_endpoint_responses 表的索引
        Schema::table('magic_api_premium_endpoint_responses', function (Blueprint $table) {
            // 删除旧索引
            if (Schema::hasIndex('magic_api_premium_endpoint_responses', 'endpoint_id_created_at_index')) {
                $table->dropIndex('endpoint_id_created_at_index');
            }
            if (Schema::hasIndex('magic_api_premium_endpoint_responses', 'request_id_index')) {
                $table->dropIndex('request_id_index');
            }
            // 添加新索引
            $table->index(['created_at', 'endpoint_id'], 'endpoint_id_created_at_index');
        });

        // 修改 magic_api_premium_endpoint_statistics 表的索引
        Schema::table('magic_api_premium_endpoint_statistics', function (Blueprint $table) {
            // 删除旧索引
            if (Schema::hasIndex('magic_api_premium_endpoint_statistics', 'unique_endpoint_id_statistics_level_time')) {
                $table->dropIndex('unique_endpoint_id_statistics_level_time');
            }

            // 添加新索引
            $table->unique(['statistics_time', 'statistics_level', 'endpoint_id'], 'unique_statistics_time');
        });
    }

    public function down(): void
    {
    }
}
