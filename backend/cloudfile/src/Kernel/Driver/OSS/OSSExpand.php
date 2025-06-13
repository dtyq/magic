<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\OSS;

use AlibabaCloud\Client\AlibabaCloud;
use AlibabaCloud\Sts\Sts;
use DateTime;
use Dtyq\CloudFile\Kernel\Driver\ExpandInterface;
use Dtyq\CloudFile\Kernel\Exceptions\ChunkDownloadException;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FileMetadata;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use League\Flysystem\FileAttributes;
use OSS\OssClient;

class OSSExpand implements ExpandInterface
{
    private array $config;

    private OssClient $client;

    private string $bucket;

    public function __construct(array $config = [])
    {
        $this->config = $config;

        $this->bucket = $config['bucket'];
        $this->client = $this->createClient($config);
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        return $credentialPolicy->isSts() ? $this->getUploadCredentialBySts($credentialPolicy) : $this->getUploadCredentialBySimple($credentialPolicy);
    }

    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        return [];
    }

    public function getFileLinks(array $paths, array $downloadNames = [], int $expires = 3600, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $downloadName = $downloadNames[$path] ?? '';
            $url = $this->signUrl($path, $expires, $downloadName, $options);
            $list[$path] = new FileLink($path, $url, $expires, $downloadName);
        }
        return $list;
    }

    /**
     * @phpstan-ignore-next-line (FileAttributes is compatible with expected return type)
     */
    public function getMetas(array $paths, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $list[$path] = $this->getMeta($path);
        }
        return $list;
    }

    public function destroy(array $paths, array $options = []): void
    {
        foreach ($paths as $path) {
            $this->client->deleteObject($this->bucket, $path);
        }
    }

    public function duplicate(string $source, string $destination, array $options = []): string
    {
        $this->client->copyObject($this->bucket, $source, $this->bucket, $destination);
        return $destination;
    }

    public function downloadByChunks(string $filePath, string $localPath, ChunkDownloadConfig $config, array $options = []): void
    {
        throw new ChunkDownloadException('OSS chunk download not implemented yet. Reserved for future implementation.');
    }

    /**
     * @see https://www.alibabacloud.com/help/zh/oss/developer-reference/getobjectmeta
     */
    private function getMeta(string $path): FileMetadata
    {
        $data = $this->client->getObjectMeta($this->bucket, $path);
        $fileName = basename($path);

        return new FileMetadata(
            $fileName,
            $path,
            new FileAttributes(
                $path,
                (int) ($data['content-length'] ?? 0),
                null,
                (int) (new DateTime($data['last-modified']))->getTimestamp(),
                $data['content-type'] ?? null
            )
        );
    }

    private function signUrl(string $path, int $timeout = 60, string $downloadName = '', array $options = []): string
    {
        if (! empty($downloadName)) {
            $options['response-content-disposition'] = 'attachment;filename="' . $downloadName . '"';
        }
        // 如果是图片，做图片处理
        if (EasyFileTools::isImage($path) && ! empty($options['image']['process'])) {
            $options['x-oss-process'] = $options['image']['process'];
        }
        $path = ltrim($path, '/');
        $url = $this->client->signUrl($this->bucket, $path, $timeout, OssClient::OSS_HTTP_GET, $options);

        if (! empty($this->config['cdn'])) {
            $urlParse = parse_url($url);
            $url = "{$this->config['cdn']}{$urlParse['path']}?{$urlParse['query']}";
        }

        return $url;
    }

    /**
     * @see https://help.aliyun.com/zh/oss/use-cases/obtain-signature-information-from-the-server-and-upload-data-to-oss
     */
    private function getUploadCredentialBySimple(CredentialPolicy $credentialPolicy): array
    {
        $expires = $credentialPolicy->getExpires();

        $now = new DateTime();
        $end = $now->modify("+{$expires} seconds");

        $expiration = $this->gmtIso8601($end);

        $conditions = [
            ['bucket' => $this->config['bucket']],
        ];
        if (! empty($credentialPolicy->getSizeMax())) {
            $conditions[] = ['content-length-range', 0, $credentialPolicy->getSizeMax()];
        }
        if (! empty($credentialPolicy->getDir())) {
            $conditions[] = ['starts-with', '$key', $credentialPolicy->getDir()];
        }
        if (! empty($credentialPolicy->getMimeType())) {
            $conditions[] = ['in', '$content-type', $credentialPolicy->getMimeType()];
        }

        $base64policy = base64_encode(json_encode(['expiration' => $expiration, 'conditions' => $conditions]));
        $signature = base64_encode(hash_hmac('sha1', $base64policy, $this->config['accessSecret'], true));

        $endpointParse = parse_url($this->config['endpoint']);
        $host = "{$endpointParse['scheme']}://{$this->config['bucket']}.{$endpointParse['host']}";

        return [
            'accessid' => $this->config['accessId'],
            'host' => $host,
            'policy' => $base64policy,
            'signature' => $signature,
            'expires' => $end->getTimestamp(),
            'dir' => $credentialPolicy->getDir(),
            'callback' => '', // 取消回调
        ];
    }

    /**
     * @see https://help.aliyun.com/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss?spm=a2c4g.11186623.0.i4#concept-xzh-nzk-2gb
     */
    private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy): array
    {
        $roleSessionName = $credentialPolicy->getRoleSessionName() ?: uniqid('easy_file_');
        $roleArn = $this->config['role_arn'] ?? '';
        if (empty($roleArn)) {
            throw new CloudFileException('未配置role_arn');
        }

        // 目前的过期时间限制为 900~3600
        $expires = max(900, min(3600, $credentialPolicy->getExpires()));

        // 通过endpoint获取region
        $region = explode('.', parse_url($this->config['endpoint'])['host'])[0];

        AlibabaCloud::accessKeyClient($this->config['accessId'], $this->config['accessSecret'])->regionId(ltrim($region, 'oss-'))->asDefaultClient();

        // 目录限制
        $resource = "{$this->config['bucket']}/";
        if (! empty($credentialPolicy->getDir())) {
            $resource = $resource . $credentialPolicy->getDir();
        }

        // 限制上传策略
        $stsPolicy = [
            'Statement' => [
                [
                    'Action' => [
                        'oss:PutObject',
                        'oss:AbortMultipartUpload',
                        'oss:ListParts',
                    ],
                    'Resource' => [
                        "acs:oss:*:*:{$resource}*",
                    ],
                    'Effect' => 'Allow',
                ],
            ],
        ];

        $sts = Sts::v20150401()->assumeRole([
            'query' => [
                'RegionId' => 'cn-shenzhen',
                'RoleArn' => $this->config['role_arn'],
                'RoleSessionName' => $roleSessionName,
                'DurationSeconds' => $expires,
                'Policy' => json_encode($stsPolicy),
            ],
        ])->request()->toArray();

        return [
            'region' => $region,
            'access_key_id' => $sts['Credentials']['AccessKeyId'],
            'access_key_secret' => $sts['Credentials']['AccessKeySecret'],
            'sts_token' => $sts['Credentials']['SecurityToken'],
            'bucket' => $this->config['bucket'],
            'dir' => $credentialPolicy->getDir(),
            'expires' => $expires,
            'callback' => '',
        ];
    }

    private function gmtIso8601(DateTime $time): string
    {
        $dStr = $time->format('Y-m-d H:i:s');
        $expiration = str_replace(' ', 'T', $dStr);
        return $expiration . '.000Z';
    }

    private function createClient(array $config): OssClient
    {
        $accessId = $config['accessId'];
        $accessSecret = $config['accessSecret'];
        $endpoint = $config['endpoint'] ?? 'oss-cn-hangzhou.aliyuncs.com';
        $timeout = $config['timeout'] ?? 3600;
        $connectTimeout = $config['connectTimeout'] ?? 10;
        $isCName = $config['isCName'] ?? false;
        $token = $config['token'] ?? null;
        $proxy = $config['proxy'] ?? null;

        $client = new OssClient(
            $accessId,
            $accessSecret,
            $endpoint,
            $isCName,
            $token,
            $proxy,
        );

        $client->setTimeout($timeout);
        $client->setConnectTimeout($connectTimeout);
        return $client;
    }
}
