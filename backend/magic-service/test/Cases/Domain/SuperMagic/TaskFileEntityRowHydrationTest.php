<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic;

use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Repository\Model\TaskFileModel;
use PHPUnit\Framework\TestCase;

/**
 * TaskFileRepository 在大列表场景（文件树、子树收集）不再经过 Eloquent 模型水合，
 * 改为 TaskFileEntity::fromRow() 直接赋值。两者的字段语义必须完全一致，
 * 否则会静默改变业务数据（例如 is_directory 变成字符串、storage_type 丢失）。
 *
 * @internal
 */
class TaskFileEntityRowHydrationTest extends TestCase
{
    /**
     * @dataProvider rawRowProvider
     *
     * @param array<string, mixed> $row
     */
    public function testFromRowKeepsEloquentHydrationSemantics(array $row): void
    {
        $viaEloquent = new TaskFileEntity(self::hydrateThroughModel($row));
        $viaRow = TaskFileEntity::fromRow($row);

        $this->assertSame(
            $viaEloquent->toArray(),
            $viaRow->toArray(),
            'fromRow() 与 Eloquent 模型水合的结果必须逐字段一致'
        );
    }

    /**
     * 仓储层现在把 TaskFileModel::getAttributes() 交给 fromRow()，而不是 toArray()。
     * 这里钉住这个契约：getAttributes() 返回的就是未经 cast 的列值。
     *
     * 之所以不用底层查询构建器（applyScopes()->getQuery()->get()）直接取行，是因为
     * 那条路径返回数组还是对象取决于连接的 fetch 模式，不同环境实测不一致。
     *
     * @dataProvider rawRowProvider
     *
     * @param array<string, mixed> $row
     */
    public function testGetAttributesFeedsFromRowWithRawColumns(array $row): void
    {
        $model = new TaskFileModel();
        $model->setRawAttributes($row, true);

        $this->assertSame($row, $model->getAttributes(), 'getAttributes() 必须原样返回列值');
        $this->assertSame(
            TaskFileEntity::fromRow($row)->toArray(),
            TaskFileEntity::fromRow($model->getAttributes())->toArray(),
            '经 getAttributes() 的水合结果必须与直接传列值一致'
        );
    }

    /**
     * 数据表原始行；取值范围参考 TaskFileModel 的 casts 与列类型。
     *
     * @return array<string, array{0: array<string, mixed>}>
     */
    public static function rawRowProvider(): array
    {
        return [
            '项目文件' => [self::row()],
            '目录' => [self::row(['is_directory' => 1, 'file_type' => 'directory', 'file_extension' => '', 'file_size' => 0])],
            '可空字段全空' => [self::row([
                'source_file_id' => null,
                'external_url' => null,
                'metadata' => null,
                'display_config' => null,
                'deleted_at' => null,
                'latest_modified_topic_id' => null,
                'latest_modified_task_id' => null,
                'parent_id' => null,
            ])],
            '带删除时间' => [self::row(['deleted_at' => '2026-01-02 03:04:05'])],
            '用户空间文件' => [self::row(['project_id' => 0, 'space_type' => 'user', 'storage_type' => 'user'])],
            '话题空间文件' => [self::row(['topic_id' => 99, 'space_type' => 'topic', 'storage_type' => 'topic'])],
            'storage_type=object_storage' => [self::row(['storage_type' => 'object_storage'])],
            'storage_type=空字符串(OTHERS)' => [self::row(['storage_type' => ''])],
            'source=0(DEFAULT)' => [self::row(['source' => 0])],
            'source=8(SKILL)' => [self::row(['source' => 8])],
            'source=字符串数字' => [self::row(['source' => '3'])],
            '隐藏文件' => [self::row(['is_hidden' => 1, 'file_name' => '.env'])],
            '空 metadata' => [self::row(['metadata' => '{}'])],
        ];
    }

    /**
     * 行里缺列时（例如上层只 select 了部分列）应保持属性声明里的默认值。
     */
    public function testFromRowKeepsDeclaredDefaultsForMissingColumns(): void
    {
        $entity = TaskFileEntity::fromRow(['file_id' => 7]);

        $this->assertSame(7, $entity->getFileId());
        $this->assertSame(1, $entity->getLatestVersion());
        $this->assertSame(1, $entity->getMetadataVersion());
        $this->assertSame('project', $entity->getSpaceType());
        $this->assertSame(StorageType::WORKSPACE, $entity->getStorageType());
        $this->assertSame('', $entity->getFileName());
        $this->assertNull($entity->getParentId());
        $this->assertNull($entity->getDeletedAt());
        $this->assertFalse($entity->getIsDirectory());
    }

    /**
     * 脏数据兜底：Eloquent 的 enum cast 遇到非法值会抛 ValueError 让整个请求 500，
     * fromRow() 沿用 setSource()/setStorageType() 的回落语义（这是两条路径唯一的有意差异）。
     */
    public function testFromRowFallsBackOnUnknownEnumValues(): void
    {
        $entity = TaskFileEntity::fromRow([
            'file_id' => 1,
            'storage_type' => 'not-a-storage-type',
            'source' => 42,
        ]);

        $this->assertSame(StorageType::WORKSPACE, $entity->getStorageType());
        $this->assertSame(TaskFileSource::DEFAULT, $entity->getSource());
    }

    /**
     * getAllDescendantIds() 的 BFS 用 `(bool) $attributes['is_directory']` 取代
     * 模型的 boolean cast（省掉每行一次 Model::__get()），这里钉住两者结果一致。
     */
    public function testRawIsDirectoryMatchesModelCast(): void
    {
        foreach ([1, 0, '1', '0'] as $raw) {
            $model = new TaskFileModel();
            $model->setRawAttributes(['file_id' => 5, 'is_directory' => $raw], true);

            $this->assertSame(
                $model->is_directory,
                (bool) $model->getAttributes()['is_directory'],
                "is_directory={$raw} 时原始值取 bool 必须与模型 cast 一致"
            );
        }

        $model = new TaskFileModel();
        $model->setRawAttributes(['file_id' => 5, 'is_directory' => 1], true);
        $this->assertTrue((bool) $model->getAttributes()['is_directory']);

        $model = new TaskFileModel();
        $model->setRawAttributes(['file_id' => 5, 'is_directory' => 0], true);
        $this->assertFalse((bool) $model->getAttributes()['is_directory']);
    }

    /**
     * 字符串数字（部分 PDO 配置会 STRINGIFY_FETCHES）也应能正确落成 int/bool。
     */
    public function testFromRowAcceptsStringifiedNumericColumns(): void
    {
        $entity = TaskFileEntity::fromRow([
            'file_id' => '9',
            'project_id' => '42',
            'parent_id' => '7',
            'file_size' => '1024',
            'is_directory' => '1',
            'is_hidden' => '0',
            'metadata_version' => '3',
        ]);

        $this->assertSame(9, $entity->getFileId());
        $this->assertSame(42, $entity->getProjectId());
        $this->assertSame(7, $entity->getParentId());
        $this->assertSame(1024, $entity->getFileSize());
        $this->assertTrue($entity->getIsDirectory());
        $this->assertFalse($entity->getIsHidden());
        $this->assertSame(3, $entity->getMetadataVersion());
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function row(array $overrides = []): array
    {
        return array_merge([
            'file_id' => 100,
            'source_file_id' => 12,
            'user_id' => 'u-1',
            'organization_code' => 'org-1',
            'project_id' => 42,
            'topic_id' => 0,
            'latest_modified_topic_id' => 7,
            'task_id' => 0,
            'latest_modified_task_id' => 8,
            'file_type' => 'file',
            'file_name' => '目录A/文件1.json',
            'file_extension' => 'json',
            'file_key' => 'magicfs/100',
            'file_size' => 2048,
            'external_url' => 'https://example.com/a.json',
            'storage_type' => 'workspace',
            'is_hidden' => 0,
            'is_directory' => 0,
            'sort' => 3,
            'parent_id' => 1,
            'metadata' => '{"mode":420,"local_shadow":"1"}',
            'display_config' => '{"hidden":false}',
            'source' => 2,
            'latest_version' => 5,
            'metadata_version' => 6,
            'space_type' => 'project',
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-02 00:00:00',
            'deleted_at' => null,
        ], $overrides);
    }

    /**
     * 复刻生产路径：Eloquent 模型 -> toArray()（含 casts）-> 构造函数水合。
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function hydrateThroughModel(array $row): array
    {
        $model = new TaskFileModel();
        $model->setRawAttributes($row, true);

        return $model->toArray();
    }
}
