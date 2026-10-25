<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

use Dtyq\CloudFile\Kernel\Constant\StsType;

/**
 * 云存储 STS 策略构建器。
 */
final class StsPolicyBuilder
{
    /**
     * 构建阿里云 OSS STS 策略。
     *
     * @param array<int, string> $stsTypes
     */
    public function buildOss(string $bucket, string $dir, array $stsTypes): array
    {
        $resource = $bucket . '/' . $dir;
        $statements = [];
        foreach ($this->withDefaultType($stsTypes) as $stsType) {
            if ($stsType === StsType::LIST_OBJECTS) {
                $this->appendStatement($statements, [
                    'Action' => ['oss:ListObjects', 'oss:ListObjectVersions'],
                    'Resource' => ["acs:oss:*:*:{$bucket}"],
                    'Condition' => [
                        'StringLike' => ['oss:Prefix' => [$dir, "{$dir}*"]],
                    ],
                    'Effect' => 'Allow',
                ]);
                continue;
            }
            if ($stsType === StsType::DEL_OBJECTS) {
                $this->appendStatement($statements, [
                    'Action' => [
                        'oss:DeleteObject',
                        'oss:DeleteObjectVersion',
                        'oss:DeleteObjectTagging',
                        'oss:DeleteObjectVersionTagging',
                    ],
                    'Resource' => ["acs:oss:*:*:{$resource}*"],
                    'Effect' => 'Allow',
                ]);
                continue;
            }
            $this->appendStatement($statements, [
                'Action' => [
                    'oss:PutObject',
                    'oss:AbortMultipartUpload',
                    'oss:GetObject',
                    'oss:ListParts',
                    'oss:GetObjectMeta',
                ],
                'Resource' => ["acs:oss:*:*:{$resource}*"],
                'Effect' => 'Allow',
            ]);
        }

        return ['Statement' => $statements];
    }

    /**
     * 构建火山引擎 TOS STS 策略。
     *
     * @param array<int, string> $stsTypes
     */
    public function buildTos(string $bucket, string $dir, array $stsTypes): array
    {
        $resource = $bucket . '/' . $dir;
        $statements = [];
        foreach ($this->withDefaultType($stsTypes) as $stsType) {
            if ($stsType === StsType::LIST_OBJECTS) {
                $this->appendStatement($statements, [
                    'Action' => ['tos:ListBucket', 'tos:ListBucketVersions'],
                    'Resource' => ["trn:tos:::{$bucket}"],
                    'Condition' => [
                        'StringLike' => ['tos:prefix' => [$dir, "{$dir}*"]],
                    ],
                    'Effect' => 'Allow',
                ]);
                continue;
            }
            if ($stsType === StsType::DEL_OBJECTS) {
                $this->appendStatement($statements, [
                    'Action' => ['tos:DeleteObject', 'tos:DeleteObjectTagging'],
                    'Resource' => ["trn:tos:::{$resource}*"],
                    'Effect' => 'Allow',
                ]);
                continue;
            }
            $this->appendStatement($statements, [
                'Action' => [
                    'tos:AppendObject',
                    'tos:PutObject',
                    'tos:GetObject',
                    'tos:AbortMultipartUpload',
                    'tos:ListMultipartUploadParts',
                    'tos:GetObjectVersion',
                ],
                'Resource' => ["trn:tos:::{$resource}*"],
                'Effect' => 'Allow',
            ]);
        }

        return ['Statement' => $statements];
    }

    /**
     * 构建 S3 兼容存储 STS 策略。
     *
     * @param array<int, string> $stsTypes
     */
    public function buildS3(string $bucket, string $dir, array $stsTypes): array
    {
        $bucketArn = "arn:aws:s3:::{$bucket}";
        $resource = $dir === ''
            ? $bucketArn
            : ["{$bucketArn}/{$dir}", "{$bucketArn}/{$dir}*"];
        $statements = [];
        foreach ($this->withDefaultType($stsTypes) as $stsType) {
            if ($stsType === StsType::LIST_OBJECTS) {
                $this->appendStatement($statements, [
                    'Effect' => 'Allow',
                    'Action' => ['s3:ListBucket', 's3:ListBucketVersions'],
                    'Resource' => $bucketArn,
                    'Condition' => [
                        'StringLike' => ['s3:prefix' => [$dir, "{$dir}*"]],
                    ],
                ]);
                continue;
            }
            if ($stsType === StsType::DEL_OBJECTS) {
                $this->appendStatement($statements, [
                    'Effect' => 'Allow',
                    'Action' => ['s3:DeleteObject', 's3:DeleteObjectVersion'],
                    'Resource' => $resource,
                ]);
                continue;
            }
            $this->appendStatement($statements, [
                'Effect' => 'Allow',
                'Action' => [
                    's3:PutObject',
                    's3:GetObject',
                    's3:AbortMultipartUpload',
                    's3:ListMultipartUploadParts',
                    's3:GetObjectVersion',
                ],
                'Resource' => $resource,
            ]);
        }

        return [
            'Version' => '2012-10-17',
            'Statement' => $statements,
        ];
    }

    /**
     * 为未显式指定类型的旧调用补充历史默认上传权限。
     *
     * @param array<int, string> $stsTypes
     * @return array<int, string>
     */
    private function withDefaultType(array $stsTypes): array
    {
        return $stsTypes === []
            ? [StsType::UPLOAD_OBJECTS]
            : StsType::parse(implode('|', $stsTypes));
    }

    /**
     * 追加策略语句，并避免等价权限重复。
     */
    private function appendStatement(array &$statements, array $statement): void
    {
        foreach ($statements as $existingStatement) {
            if ($existingStatement === $statement) {
                return;
            }
        }
        $statements[] = $statement;
    }
}
