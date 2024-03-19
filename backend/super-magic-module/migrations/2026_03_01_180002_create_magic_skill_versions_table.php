<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_skill_versions')) {
            return;
        }
        Schema::create('magic_skill_versions', static function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键 ID（版本ID）');
            $table->string('code', 64)->comment('Skill 唯一标识码，对应 magic_skills.code，同一 Skill 的所有版本共享同一个 code');
            $table->string('organization_code', 64)->comment('归属组织编码');
            $table->string('creator_id', 64)->comment('创建操作人用户 ID');
            $table->string('package_name', 128)->comment('Skill 包唯一标识名，来自压缩包 skill.md，同一组织下，创建者唯一');
            $table->text('package_description')->nullable()->comment('Skill 包描述，来自压缩包 skill.md，同一组织下唯一');
            $table->string('version', 32)->comment('当前生效版本号，如 1.0.0');
            $table->json('name_i18n')->comment('多语言展示名，格式：{"en":"Web Search","zh":"网页搜索"}，必须包含 en；name 字段从此 JSON 的 en 值提取');
            $table->json('description_i18n')->nullable()->comment('多语言展示描述，格式同 name_i18n；description 字段从此 JSON 的 en 值提取');
            $table->string('logo', 512)->nullable()->comment('Logo 图片 URL；异步 AI 生成完成后更新');
            $table->string('file_key', 512)->comment('压缩包在对象存储中的 key');
            $table->string('publish_status', 32)->default('PENDING')->comment('发布状态：PENDING=待发布, PUBLISHING=发布中, PUBLISHED=已发布, OFFLINE=已下架');
            $table->string('review_status', 32)->default('UNDER_REVIEW')->comment('审核状态：UNDER_REVIEW=审核中, APPROVED=审核通过, REJECTED=审核拒绝');
            $table->string('source_type', 32)->comment('来源类型：LOCAL_UPLOAD=本地上传（自动跟随最新版）, STORE=商店添加（手动升级）, GITHUB=GitHub 导入');
            $table->bigInteger('source_id')->nullable()->comment('来源关联 ID：source_type=STORE 时关联 magic_skill_market.id，其余为 NULL');
            $table->bigInteger('project_id')->nullable()->comment('项目ID');
            $table->json('source_meta')->nullable()->comment('来源扩展元数据；GITHUB 时存储 repo_url/branch 等，STORE 时可存储商店快照信息');
            $table->timestamps();
            $table->softDeletes()->comment('软删除时间；删除后 Crew 执行时报错「该 Skill 已被删除」');

            $table->index(['creator_id', 'organization_code'], 'idx_creator_org');
            $table->index(['code'], 'idx_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
