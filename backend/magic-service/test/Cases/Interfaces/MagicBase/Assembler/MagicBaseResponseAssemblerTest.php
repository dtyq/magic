<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\MagicBase\Assembler;

use App\Interfaces\MagicBase\Assembler\MagicBaseResponseAssembler;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
final class MagicBaseResponseAssemblerTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (ApplicationContext::hasContainer()) {
            return;
        }

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id)
            {
                return match ($id) {
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    default => throw new RuntimeException('Unsupported service: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class;
            }
        });
    }

    public function testTableSummarySerializesIdAsString(): void
    {
        $response = MagicBaseResponseAssembler::tableSummary([
            'id' => 958055003641278464,
            'project_id' => 958055003641278464,
        ]);

        $this->assertSame('958055003641278464', $response->jsonSerialize()['id']);
        $this->assertIsString($response->jsonSerialize()['id']);
    }
}
