<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\File\MagicFS\DTO\Request;

use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\RenameFileRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;

/**
 * rename 请求体的解析规则。
 *
 * 这里钉住的是「缺省值由谁决定」：DTO 只负责如实转述调用方给了什么，
 * on_exists 省略时保持 null，由领域层选默认策略。如果在传输层就把 null
 * 折叠成 'replace'，那么以后新增第二个入口（RPC、内部调用）时默认值会
 * 散落在多处，改一次漏一处。
 *
 * @internal
 */
class RenameFileRequestDTOTest extends TestCase
{
    public function testParsesFullPayload(): void
    {
        $dto = RenameFileRequestDTO::fromRequest($this->request([
            'new_name' => 'doc.json',
            'new_parent_id' => '500',
            'on_exists' => 'fail',
            'message_metadata' => ['trace_id' => 't-1'],
        ]));

        $this->assertSame('doc.json', $dto->new_name);
        $this->assertSame('500', $dto->new_parent_id);
        $this->assertSame('fail', $dto->on_exists);
        $this->assertSame(['trace_id' => 't-1'], $dto->message_metadata);
    }

    /**
     * 省略 on_exists 时必须保持 null：默认策略是领域层的决定，不是传输层的。
     */
    public function testOmittingOnExistsLeavesItNull(): void
    {
        $dto = RenameFileRequestDTO::fromRequest($this->request(['new_name' => 'doc.json']));

        $this->assertTrue($dto->new_parent_id === null);
        $this->assertNull($dto->on_exists, 'the transport layer must not choose the collision policy');
    }

    /**
     * 空字符串的 parent_id 等价于「保持原父目录」，解析成 null 而不是 0。
     * 否则 0 会被当成一个真实的父目录 id 去查询。
     */
    public function testEmptyParentIdMeansKeepCurrentParent(): void
    {
        $dto = RenameFileRequestDTO::fromRequest($this->request([
            'new_name' => 'doc.json',
            'new_parent_id' => '',
        ]));

        $this->assertNull($dto->new_parent_id);
    }

    /**
     * 名字两端空白被裁掉；全空白的名字会在领域层被拒绝，但 DTO 不应
     * 自行改写它，以免掩盖调用方的错误。
     */
    public function testNameIsTrimmed(): void
    {
        $dto = RenameFileRequestDTO::fromRequest($this->request(['new_name' => '  doc.json  ']));

        $this->assertSame('doc.json', $dto->new_name);
    }

    public function testMissingNameYieldsEmptyString(): void
    {
        $dto = RenameFileRequestDTO::fromRequest($this->request([]));

        $this->assertSame('', $dto->new_name);
    }

    /** @param array<string, mixed> $payload */
    private function request(array $payload): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn($payload);

        return $request;
    }
}
