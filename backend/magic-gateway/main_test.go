package main

import (
	"encoding/json"
	"testing"
)

func TestProcessRequestBodyForSpecificServices_JSON(t *testing.T) {
	// 模拟环境变量
	envVars = map[string]string{
		"TEXT_TO_IMAGE_API_BASE_URL": "http://test-image-api",
		"MY_ENV": "replaced_value",
	}

	// 构造 JSON body
	body := map[string]interface{}{
		"prompt": "env:MY_ENV",
		"other":  "nochange",
		"nested": map[string]interface{}{
			"key": "${MY_ENV}",
		},
	}
	bodyBytes, _ := json.Marshal(body)

	// 调用函数
	result := processRequestBodyForSpecificServices(bodyBytes, "application/json", "TEXT_TO_IMAGE_API_BASE_URL")

	// 解析结果
	var resultObj map[string]interface{}
	_ = json.Unmarshal(result, &resultObj)

	if resultObj["prompt"] != "replaced_value" {
		t.Errorf("env:MY_ENV 替换失败，got: %v", resultObj["prompt"])
	}
	if resultObj["other"] != "nochange" {
		t.Errorf("无关字段被错误替换，got: %v", resultObj["other"])
	}
	nested := resultObj["nested"].(map[string]interface{})
	if nested["key"] != "replaced_value" {
		t.Errorf("${MY_ENV} 替换失败，got: %v", nested["key"])
	}
}

func TestProcessRequestBodyForSpecificServices_Form(t *testing.T) {
	envVars = map[string]string{
		"VOICE_UNDERSTANDING_API_BASE_URL": "http://voice-api",
		"MY_ENV": "replaced_value",
	}
	// 构造 x-www-form-urlencoded body
	body := "field1=env:MY_ENV&field2=${MY_ENV}&field3=plain"
	result := processRequestBodyForSpecificServices([]byte(body), "application/x-www-form-urlencoded", "VOICE_UNDERSTANDING_API_BASE_URL")
	resultStr := string(result)
	if resultStr != "field1=replaced_value&field2=replaced_value&field3=plain" {
		t.Errorf("form 替换失败，got: %s", resultStr)
	}
}

func TestProcessRequestBodyForSpecificServices_NotSpecial(t *testing.T) {
	envVars = map[string]string{
		"MY_ENV": "replaced_value",
	}
	body := []byte(`{"prompt":"env:MY_ENV"}`)
	result := processRequestBodyForSpecificServices(body, "application/json", "NOT_SPECIAL_URL")
	if string(result) != string(body) {
		t.Errorf("非特殊服务不应替换，got: %s", string(result))
	}
}
