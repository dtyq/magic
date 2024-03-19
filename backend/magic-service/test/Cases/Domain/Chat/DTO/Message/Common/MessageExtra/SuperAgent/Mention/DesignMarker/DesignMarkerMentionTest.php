<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker\DesignMarkerData;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker\DesignMarkerMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class DesignMarkerMentionTest extends TestCase
{
    public function testDesignMarkerDataCreation(): void
    {
        $data = new DesignMarkerData([
            'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
            'label' => '棕色耳尖',
            'kind' => 'object',
            'mark' => [0.64, 0.64],
            'mark_number' => 1,
            'bbox' => [
                'x' => 0.64,
                'y' => 0.07,
                'width' => 0.13,
                'height' => 0.21,
            ],
        ]);

        $this->assertEquals('/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg', $data->getImage());
        $this->assertEquals('棕色耳尖', $data->getLabel());
        $this->assertEquals('object', $data->getKind());
        $this->assertIsArray($data->getMark());
        $this->assertEquals([0.64, 0.64], $data->getMark());
        $this->assertEquals(1, $data->getMarkNumber());
        $this->assertIsArray($data->getBbox());
        $this->assertEquals(0.64, $data->getBbox()['x']);
        $this->assertEquals(0.07, $data->getBbox()['y']);
        $this->assertEquals(0.13, $data->getBbox()['width']);
        $this->assertEquals(0.21, $data->getBbox()['height']);
    }

    public function testDesignMarkerMentionCreation(): void
    {
        $mention = new DesignMarkerMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'design_marker',
                'data' => [
                    'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
                    'label' => '棕色耳尖',
                    'kind' => 'object',
                    'mark' => [0.64, 0.64],
                    'mark_number' => 1,
                    'bbox' => [
                        'x' => 0.64,
                        'y' => 0.07,
                        'width' => 0.13,
                        'height' => 0.21,
                    ],
                ],
            ],
        ]);

        $this->assertEquals('mention', $mention->getType());
        $this->assertEquals(MentionType::DESIGN_MARKER, $mention->getAttrs()->getType());

        $data = $mention->getAttrs()->getData();
        $this->assertInstanceOf(DesignMarkerData::class, $data);
        assert($data instanceof DesignMarkerData);
        $this->assertEquals('棕色耳尖', $data->getLabel());
    }

    public function testGetMentionTextStruct(): void
    {
        $mention = new DesignMarkerMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'design_marker',
                'data' => [
                    'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
                    'label' => '棕色耳尖',
                    'kind' => 'object',
                    'mark' => [0.64, 0.64],
                    'mark_number' => 1,
                    'bbox' => [
                        'x' => 0.64,
                        'y' => 0.07,
                        'width' => 0.13,
                        'height' => 0.21,
                    ],
                ],
            ],
        ]);

        $textStruct = $mention->getMentionTextStruct();
        $this->assertEquals('', $textStruct);
    }

    public function testGetMentionJsonStruct(): void
    {
        $mention = new DesignMarkerMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'design_marker',
                'data' => [
                    'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
                    'label' => '棕色耳尖',
                    'kind' => 'object',
                    'mark' => [0.64, 0.64],
                    'mark_number' => 1,
                    'bbox' => [
                        'x' => 0.64,
                        'y' => 0.07,
                        'width' => 0.13,
                        'height' => 0.21,
                    ],
                ],
            ],
        ]);

        $jsonStruct = $mention->getMentionJsonStruct();
        $this->assertEquals('design_marker', $jsonStruct['type']);
        $this->assertEquals('/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg', $jsonStruct['image']);
        $this->assertEquals('棕色耳尖', $jsonStruct['label']);
        $this->assertEquals('object', $jsonStruct['kind']);
        $this->assertIsArray($jsonStruct['mark']);
        $this->assertEquals([0.64, 0.64], $jsonStruct['mark']);
        $this->assertEquals(1, $jsonStruct['mark_number']);
        $this->assertIsArray($jsonStruct['bbox']);
        $this->assertEquals(0.64, $jsonStruct['bbox']['x']);
        $this->assertEquals(0.07, $jsonStruct['bbox']['y']);
        $this->assertEquals(0.13, $jsonStruct['bbox']['width']);
        $this->assertEquals(0.21, $jsonStruct['bbox']['height']);
    }

    public function testMentionAssemblerFromArray(): void
    {
        $mentionArray = [
            'type' => 'mention',
            'attrs' => [
                'type' => 'design_marker',
                'data' => [
                    'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
                    'label' => '棕色耳尖',
                    'kind' => 'object',
                    'mark' => [0.64, 0.64],
                    'mark_number' => 1,
                    'bbox' => [
                        'x' => 0.64,
                        'y' => 0.07,
                        'width' => 0.13,
                        'height' => 0.21,
                    ],
                ],
            ],
        ];

        $mention = MentionAssembler::fromArray($mentionArray);
        $this->assertInstanceOf(DesignMarkerMention::class, $mention);
        assert($mention instanceof DesignMarkerMention);

        $data = $mention->getAttrs()->getData();
        $this->assertInstanceOf(DesignMarkerData::class, $data);
        assert($data instanceof DesignMarkerData);
        $this->assertEquals('棕色耳尖', $data->getLabel());
        $this->assertEquals('object', $data->getKind());
    }

    public function testJsonSerializable(): void
    {
        $mention = new DesignMarkerMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'design_marker',
                'data' => [
                    'image' => '/新建画布/images/d1e68175-b629-4515-8ca3-c87803cebe67.jpg',
                    'label' => '棕色耳尖',
                    'kind' => 'object',
                    'mark' => [0.64, 0.64],
                    'mark_number' => 1,
                    'bbox' => [
                        'x' => 0.64,
                        'y' => 0.07,
                        'width' => 0.13,
                        'height' => 0.21,
                    ],
                ],
            ],
        ]);

        $json = json_encode($mention);
        $this->assertIsString($json);

        $decoded = json_decode($json, true);
        $this->assertEquals('mention', $decoded['type']);
        $this->assertEquals('design_marker', $decoded['attrs']['type']);
        $this->assertEquals('棕色耳尖', $decoded['attrs']['data']['label']);
    }
}
