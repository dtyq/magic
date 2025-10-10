<?php

declare(strict_types=1);

use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            $table->bigInteger('from_task_id')
                ->nullable()
                ->default(null)
                ->comment('复制来源任务ID，NULL表示不是复制的任务')
                ->after('topic_id');
            
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

    }
};
