<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Api\Image;

use Exception;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;
use Throwable;

use function Hyperf\Support\retry;

/**
 * @internal
 */
class DoubaoImageTest extends AbstractApiTest
{
    private const V1_BASE_URI = '/v1/images';

    private const V2_BASE_URI = '/v2/images';

    public function testV1Generations()
    {
        $model = 'doubao-seedream-4-0-250828';

        $params = [
            'model' => $model,
            'n' => 1,
            'prompt' => '生成一张白色图片',
            'size' => '1664x928',
        ];

        $response = retry(2, function () use ($params) {
            return $this->client->post(
                self::V1_BASE_URI . '/generations',
                $params,
                $this->getCommonHeaders()
            );
        });
        $this->assertTrue($response['0']['success'] ?? false, Json::encode($response));
    }

    public function testV2Generations()
    {
        $model = 'doubao-seedream-4-0-250828';

        $params = [
            'model' => $model,
            'n' => 1,
            'prompt' => '生成一张白色图片',
            'size' => '2:2',
        ];
        try {
            $response = retry(2, function () use ($params) {
                $response = $this->client->post(
                    self::V2_BASE_URI . '/generations',
                    $params,
                    $this->getCommonHeaders()
                );
                if (count($response['data']) === 0) {
                    throw new Exception($response['provider_error_message']);
                }
                return $response;
            });
        } catch (Throwable $throwable) {
            $response = [
                'data' => [],
                'provider_error_message' => $throwable->getMessage(),
            ];
        }
        $this->assertEquals(1, count($response['data'] ?? []), 'v2/generations 失败 : ' . ($response['provider_error_message'] ?? ''));
    }

    public function testV1Edit()
    {
        $model = 'doubao-seedream-4-0-250828';

        $params = [
            'model' => $model,
            'images' => [
                '/MAGIC/713471849556451329/4c9184f37cff01bcdc32dc486ec36961/open/68be511ebc011.png',
            ],
            'prompt' => '加一只小狗',
        ];

        $response = retry(2, function () use ($params) {
            return $this->client->post(
                self::V1_BASE_URI . '/edits',
                $params,
                $this->getCommonHeaders()
            );
        });

        $this->assertTrue($response['0']['success'] ?? false, Json::encode($response));
    }

    public function testV2Edit()
    {
        $model = 'doubao-seedream-4-0-250828';

        $params = [
            'model' => $model,
            'images' => [
                '/MAGIC/713471849556451329/4c9184f37cff01bcdc32dc486ec36961/open/68be511ebc011.png',
            ],
            'prompt' => '加一只小狗',
        ];

        try {
            $response = retry(2, function () use ($params) {
                $response = $this->client->post(
                    self::V2_BASE_URI . '/edits',
                    $params,
                    $this->getCommonHeaders()
                );
                if (count($response['data']) === 0) {
                    throw new Exception($response['provider_error_message']);
                }
                return $response;
            });
        } catch (Throwable $throwable) {
            $response = [
                'data' => [],
                'provider_error_message' => $throwable->getMessage(),
            ];
        }
        $this->assertEquals(1, count($response['data'] ?? []), 'v2/generations 失败 : ' . ($response['provider_error_message'] ?? ''));
    }
}
