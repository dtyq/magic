<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddIsHiddenToMagicSuperAgentTopicsTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->boolean('is_hidden')->default(false)->after('source')->comment('是否隐藏，隐藏则接口列表不返回');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropColumn('is_hidden');
        });
    }
}
