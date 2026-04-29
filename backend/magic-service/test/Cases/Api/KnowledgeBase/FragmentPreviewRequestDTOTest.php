<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\KnowledgeBase;

use App\Interfaces\KnowledgeBase\DTO\Request\FragmentPreviewRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class FragmentPreviewRequestDTOTest extends TestCase
{
    public function testFromRequestKeepsLegacyParentChildConfigUntouched(): void
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->createRequest([
            'document_file' => [
                'name' => 'demo.md',
                'key' => 'DT001/demo.md',
                'type' => 1,
            ],
            'fragment_config' => [
                'mode' => 2,
                'parent_child' => [
                    'parent_mode' => 1,
                    'parent_segment_rule' => [
                        'separator' => '\n\n',
                        'chunk_size' => 500,
                    ],
                    'child_segment_rule' => [
                        'separator' => '\n\n',
                        'chunk_size' => 300,
                    ],
                ],
            ],
        ]));

        $this->assertSame([
            'mode' => 2,
            'parent_child' => [
                'parent_mode' => 1,
                'parent_segment_rule' => [
                    'separator' => '\n\n',
                    'chunk_size' => 500,
                ],
                'child_segment_rule' => [
                    'separator' => '\n\n',
                    'chunk_size' => 300,
                ],
            ],
        ], $dto->getFragmentConfig());
    }

    public function testFromRequestKeepsNormalConfigUntouched(): void
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->createRequest([
            'fragment_config' => [
                'mode' => 2,
                'normal' => [
                    'text_preprocess_rule' => [1],
                    'segment_rule' => [
                        'separator' => '\n\n',
                        'chunk_size' => 600,
                        'chunk_overlap' => 20,
                    ],
                ],
            ],
        ]));

        $this->assertSame([
            'mode' => 2,
            'normal' => [
                'text_preprocess_rule' => [1],
                'segment_rule' => [
                    'separator' => '\n\n',
                    'chunk_size' => 600,
                    'chunk_overlap' => 20,
                ],
            ],
        ], $dto->getFragmentConfig());
    }

    public function testFromRequestKeepsRawStrategyConfigUntouched(): void
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->createRequest([
            'strategy_config' => [
                'parsing_type' => 2,
                'image_extraction' => true,
                'table_extraction' => true,
                'image_ocr' => true,
            ],
        ]));

        $this->assertSame([
            'parsing_type' => 2,
            'image_extraction' => true,
            'table_extraction' => true,
            'image_ocr' => true,
        ], $dto->getStrategyConfig());
    }

    private function createRequest(array $payload): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn($payload);

        return $request;
    }
}
