<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        $this->expandSyncTimes('knowledge_base_documents');
        $this->expandSyncTimes('magic_flow_knowledge');
        $this->expandSyncTimes('magic_flow_knowledge_fragment');
    }

    public function down(): void
    {
        // no-op: shrinking back to tinyint can overflow existing sync_times values.
    }

    private function expandSyncTimes(string $tableName): void
    {
        if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'sync_times')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table): void {
            $table->integer('sync_times')->default(0)->comment('同步次数')->change();
        });
    }
};
