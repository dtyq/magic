<?php

declare(strict_types=1);

use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            // 添加 from_topic_id 字段，记录话题复制来源
            $table->bigInteger('from_topic_id')
                ->nullable()
                ->default(null)
                ->comment('复制来源话题ID，NULL表示不是复制的话题')
                ->after('project_id');
        
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

    }
};
