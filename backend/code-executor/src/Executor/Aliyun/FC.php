<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Executor\Aliyun;

use AlibabaCloud\OpenApiUtil\OpenApiUtilClient;
use AlibabaCloud\SDK\FC\V20230330\FC as BaseFC;
use AlibabaCloud\SDK\FC\V20230330\Models\InvokeFunctionResponse;
use AlibabaCloud\Tea\Utils\Utils;
use Darabonba\OpenApi\Models\OpenApiRequest;
use Darabonba\OpenApi\Models\Params;

class FC extends BaseFC
{
    public function invokeFunctionWithOptions($functionName, $request, $headers, $runtime): InvokeFunctionResponse
    {
        Utils::validateModel($request);
        $query = [];
        if (! Utils::isUnset($request->qualifier)) {
            $query['qualifier'] = $request->qualifier;
        }
        $realHeaders = [];
        if (! Utils::isUnset($headers->commonHeaders)) {
            $realHeaders = $headers->commonHeaders;
        }
        if (! Utils::isUnset($headers->xFcAsyncTaskId)) {
            $realHeaders['x-fc-async-task-id'] = Utils::toJSONString($headers->xFcAsyncTaskId);
        }
        if (! Utils::isUnset($headers->xFcInvocationType)) {
            $realHeaders['x-fc-invocation-type'] = Utils::toJSONString($headers->xFcInvocationType);
        }
        if (! Utils::isUnset($headers->xFcLogType)) {
            $realHeaders['x-fc-log-type'] = Utils::toJSONString($headers->xFcLogType);
        }
        $req = new OpenApiRequest([
            'headers' => $realHeaders,
            'query' => OpenApiUtilClient::query($query),
            'body' => $request->body,
            'stream' => $request->body,
        ]);
        $params = new Params([
            'action' => 'InvokeFunction',
            'version' => '2023-03-30',
            'protocol' => 'HTTPS',
            'pathname' => '/2023-03-30/functions/' . OpenApiUtilClient::getEncodeParam($functionName) . '/invocations',
            'method' => 'POST',
            'authType' => 'AK',
            'style' => 'ROA',
            'reqBodyType' => 'json',
            'bodyType' => 'binary',
        ]);
        $res = new InvokeFunctionResponse([]);
        $tmp = Utils::assertAsMap($this->callApi($params, $req, $runtime));
        // 阿里云的包不支持 PHP8.1
        $body = $tmp['body'] ?? null;
        if (! Utils::isUnset($body)) {
            $respBody = Utils::assertAsReadable($body);
            $res->body = $respBody;
        }
        $headers = $tmp['headers'] ?? null;
        if (! Utils::isUnset($headers)) {
            $respHeaders = Utils::assertAsMap($headers);
            $res->headers = Utils::stringifyMapValue($respHeaders);
        }
        $statusCode = $tmp['statusCode'] ?? null;
        if (! Utils::isUnset($statusCode)) {
            $statusCode = Utils::assertAsInteger($statusCode);
            $res->statusCode = $statusCode;
        }

        return $res;
    }
}
