<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Code;

use App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor\PHPExecutor;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class PHPExecutorTest extends ExecuteManagerBaseTest
{
    public function testExecute()
    {
        $executor = new PHPExecutor();
        $res = $executor->executeCode('if( $ruleEnableCondition ) return \'ok\';', ['ruleEnableCondition' => '1 == 1']);
        $this->assertEquals('ok', $res->getResult());
    }

    public function testExecute1()
    {
        $code = <<<'PHP'
$system_prompt = "You are a large language AI assistant built by Lepton AI. You are given a user question, and please write clean, concise and accurate answer to the question. You will be given a set of related contexts to the question, each starting with a reference number like [[citation:x]], where x is a number. Please use the context and cite the context at the end of each sentence if applicable.

Your answer must be correct, accurate and written by an expert using an unbiased and professional tone. Please limit to 1024 tokens. Do not give any information that is not related to the question, and do not repeat. Say 'information is missing on' followed by the related topic, if the given context do not provide sufficient information.

Please cite the contexts with the reference numbers, in the format [citation:x]. If a sentence comes from multiple contexts, please list all applicable citations, like [citation:3][citation:5]. Other than code and specific names and citations, your answer must be written in the same language as the question.

Here are the set of contexts:\n\n";

        foreach ($contexts as $index => $context) {
            $system_prompt .= "[[citation:" . ($index + 1) . "]] " . $context['snippet'] . "\n\n";
        }
        
        return [
            'system_prompt' => $system_prompt
        ];
PHP;

        $data = [
            'contexts' => [
                [
                    'snippet' => '123',
                ],
                [
                    'snippet' => '456',
                ],
            ],
        ];
        $executor = new PHPExecutor();
        $res = $executor->executeCode($code, $data);
        $this->assertArrayHasKey('system_prompt', $res->getResult());
    }

    public function testExecute2()
    {
        $code = <<<'PHP'
$response = trim($result);
// 如果 $response 以 ```json 开头则去除
if (str_starts_with($response, '```json')) {
    $response = substr($response, 7);
}
// 如果 $response 以 ``` 结尾则去除
if (str_ends_with($response, '```')) {
    $response = substr($response, 0, -3);
}
var_dump($response);
$response = trim($response, '\n');
var_dump($response);
$response  = str_replace('\\"', '"', $response);
// 如果 $response 本身就是 JSON 格式的，那么直接返回
$decodedJson = json_decode($response, true);
echo PHP_EOL;
return [
    'source_lang' => $decodedJson['source_lang'],
    'target_lang' => $decodedJson['target_lang'],
    'translation' => $decodedJson['translation'],
];
PHP;
        $data = [
            'result' => '```json\n{\"source_lang\": \"Chinese\", \"target_lang\": \"English\", \"translation\": \"Support for topic features in conversation\"}\n```',
        ];
        $executor = new PHPExecutor();
        $res = $executor->executeCode($code, $data);
        $this->assertArrayHasKey('source_lang', $res->getResult());
        $this->assertNotEmpty($res->getDebug());
    }
}
