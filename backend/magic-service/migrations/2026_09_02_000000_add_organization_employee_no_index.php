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
        if (! Schema::hasTable('magic_contact_department_users')) {
            return;
        }

        Schema::table('magic_contact_department_users', static function (Blueprint $table) {
            $table->index(
                ['organization_code', 'employee_no'],
                'org_employee_no'
            );
        });
    }

    public function down(): void
    {
    }
};
