<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\File\MagicFS\DTO\Response;

use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\FileTreeChangeDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\GetFileTreeChangesResponseDTO;
use PHPUnit\Framework\TestCase;
use stdClass;

/**
 * change feed 出参形状回归：file 必须是 JSON object，空 file_metadata 必须是 {}。
 *
 * 背景：journal 里存的是 JSON 文本，读取时 json_decode($snapshot, true) 解成关联数组，
 * PHP 分不清 JSON 的 {} 和 []，空 file_metadata 会变成空数组，再 json_encode 出参就写成 []。
 * Go 挂载端 File.FileMetadata 是 map[string]string，收到数组会让整页 changes 解码失败
 * （cannot unmarshal array into ... file_metadata）；客户端不推进游标、按轮询间隔重试同一页，
 * 挂载端文件树再也同步不到远端变更。
 *
 * 写入侧（TaskFileRepository::fileTreeChangeSnapshot）已保证库里存的是 {}，但那只覆盖存储；
 * 出参这一层过去没有测试，于是同一个故障重复出现。本测试断言的是「出参 JSON」的形状。
 *
 * @internal
 */
class FileTreeChangeDTOTest extends TestCase
{
    /**
     * 正常行：库里存的就是 {}，出参不能把它降级成 []。
     */
    public function testEmptyFileMetadataIsServedAsEmptyJsonObject(): void
    {
        $served = $this->serveSnapshot('{"id":"1001","name":"a.txt","file_metadata":{}}');

        self::assertStringContainsString('"file_metadata":{}', $served->json);
        self::assertInstanceOf(
            stdClass::class,
            $served->decoded->changes[0]->file->file_metadata,
            '空 file_metadata 必须是 JSON object，不能是 JSON 数组'
        );
    }

    /**
     * 历史行：修复写入侧之前落库的快照里是 []，出参同样要归一化成 {}，
     * 否则卡在旧游标上的挂载端永远读不过这页（不需要数据迁移）。
     */
    public function testLegacyArrayFileMetadataIsNormalizedOnRead(): void
    {
        $served = $this->serveSnapshot('{"id":"1001","name":"a.txt","file_metadata":[]}');

        self::assertStringContainsString('"file_metadata":{}', $served->json);
        self::assertInstanceOf(stdClass::class, $served->decoded->changes[0]->file->file_metadata);
    }

    /**
     * 非空 flag 必须原样保留：local_shadow 这类插件级标记直接影响挂载端把目录
     * 当作本地影子目录还是 S3 目录，不能被归一化顺手抹掉。
     */
    public function testNonEmptyFileMetadataIsPreserved(): void
    {
        $served = $this->serveSnapshot('{"id":"1001","name":"a.txt","file_metadata":{"local_shadow":"1"}}');

        self::assertInstanceOf(stdClass::class, $served->decoded->changes[0]->file->file_metadata);
        self::assertSame('1', $served->decoded->changes[0]->file->file_metadata->local_shadow);
    }

    /**
     * 快照缺失（file_snapshot 为 NULL）时 file 也必须是 object：出参写成 [] 会让 Go 侧
     * 解析 change.File 时整页失败，和本测试覆盖的类型错误是同一个故障形态。
     */
    public function testMissingSnapshotIsServedAsEmptyJsonObject(): void
    {
        $served = $this->serveRow(['file_snapshot' => null]);

        self::assertInstanceOf(stdClass::class, $served->decoded->changes[0]->file);
        self::assertStringContainsString('"file":{}', $served->json);
    }

    /**
     * 走真实的出参链路：AppService 用 fromRow() 装行，控制器对 toArray() 结果做 json_encode。
     *
     * @param array<string, mixed> $overrides
     */
    private function serveRow(array $overrides): stdClass
    {
        $responseDTO = new GetFileTreeChangesResponseDTO();
        $responseDTO->changes[] = FileTreeChangeDTO::fromRow(array_merge([
            'revision' => 249,
            'operation' => 'create',
            'file_id' => '1001',
            'parent_id' => '1000',
            'old_parent_id' => '0',
            'name' => 'a.txt',
            'old_name' => null,
        ], $overrides));

        $json = json_encode($responseDTO->toArray(), JSON_THROW_ON_ERROR);
        $served = new stdClass();
        $served->json = $json;
        $served->decoded = json_decode($json, false, 512, JSON_THROW_ON_ERROR);

        return $served;
    }

    private function serveSnapshot(string $snapshotJson): stdClass
    {
        return $this->serveRow(['file_snapshot' => $snapshotJson]);
    }
}
