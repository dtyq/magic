<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Api\ModelGateway;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 */
class ImagesV2ApiTest extends AbstractHttpTest
{
    /**
     * 测试 chatCompletions 方法的高可用性.
     */
    public function testV2ImagesGenerations()
    {
        // 发送HTTP请求
        $response = $this->post('/v2/images/generations', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'size' => '1024x1024',
        ], $this->getCommonHeaders());

        $this->assertEquals('1024x1024', $response['data'][0]['size'], $response['data'][0]['size']);
return;
        // 发送HTTP请求
        $response = $this->post('/v2/images/generations', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'size' => '1:1',
        ], $this->getCommonHeaders());

        $this->assertEquals('2048x2048', $response['data'][0]['size'], $response['data'][0]['size']);

        // 发送HTTP请求
        $response = $this->post('/v2/images/generations', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'size' => '3:2',
        ], $this->getCommonHeaders());

        $this->assertEquals('2496x1664', $response['data'][0]['size'], $response['data'][0]['size']);
    }

    public function testV2ImagesEdit()
    {
        // 发送HTTP请求
        $response = $this->post('/v2/images/edits', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'images' => [
                'https://teamshareos-app-public-test.tos-cn-beijing.volces.com/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/open/68cd4f9164d99.jpg',
            ],
            'size' => '1024x1024',
        ], $this->getCommonHeaders());

        $this->assertEquals('1024x1024', $response['data'][0]['size'], $response['data'][0]['size']);

        // 发送HTTP请求
        $response = $this->post('/v2/images/edits', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'images' => [
                'https://teamshareos-app-public-test.tos-cn-beijing.volces.com/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/open/68cd4f9164d99.jpg',
            ],
            'size' => '1:1',
        ], $this->getCommonHeaders());

        $this->assertEquals('2048x2048', $response['data'][0]['size'], $response['data'][0]['size']);

        // 发送HTTP请求
        $response = $this->post('/v2/images/edits', [
            'model' => 'jimeng_t2i_v40',
            'prompt' => '老虎',
            'images' => [
                'https://teamshareos-app-public-test.tos-cn-beijing.volces.com/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/open/68cd4f9164d99.jpg',
            ],
            'size' => '3:2',
        ], $this->getCommonHeaders());

        $this->assertEquals('2496x1664', $response['data'][0]['size'], $response['data'][0]['size']);
    }

}
