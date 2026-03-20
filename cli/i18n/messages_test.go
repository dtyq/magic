package i18n

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"golang.org/x/text/language"
)

func TestReadTranslations(t *testing.T) {
	var testTranslations = `
zh_Hans:
  yes: "TestReadTranslations是"
en_US:
  yes: "TestReadTranslationsYes"
ja_JP:
  yes: "TestReadTranslationsはい"
`
	// read translations
	// only assert not crash
	readTranslations(testTranslations)
}

func TestGetSystemLanguage(t *testing.T) {
	type testCaseTag struct {
		lang string

		base   string
		region string
	}

	testCases := []testCaseTag{
		{
			lang:   "zh_CN.UTF-8",
			base:   "zh",
			region: "CN",
		},
		{
			lang:   "zh_CN",
			base:   "zh",
			region: "CN",
		},
		{
			lang: "zh_Hans",
			base: "zh",
		},
		{
			lang: "zh",
			base: "zh",
		},
		{
			lang: "",
		},
		{
			lang: "cafebabedeadbeef",
		},
		{
			lang:   "en_US@asia.GBK",
			base:   "en",
			region: "US",
		},
	}

	langEnv := os.Getenv("LANG")
	lcMessagesEnv := os.Getenv("LC_MESSAGES")
	lcAllEnv := os.Getenv("LC_ALL")
	defer func() {
		os.Setenv("LANG", langEnv)
		os.Setenv("LC_MESSAGES", lcMessagesEnv)
		os.Setenv("LC_ALL", lcAllEnv)
	}()

	for _, testCase := range testCases {
		// LANG case
		os.Setenv("LANG", testCase.lang)
		lang := getSystemLanguage()
		if testCase.base != "" {
			base, _ := lang.Base()
			assert.Equal(t, testCase.base, base.String())
		}
		if testCase.region != "" {
			region, _ := lang.Region()
			assert.Equal(t, testCase.region, region.String())
		}

		// LC_MESSAGES override LANG
		os.Setenv("LC_MESSAGES", "fr_FR")
		lang = getSystemLanguage()
		base, _ := lang.Base()
		assert.Equal(t, "fr", base.String())
		region, _ := lang.Region()
		assert.Equal(t, "FR", region.String())
		os.Setenv("LC_MESSAGES", "C")

		// LC_ALL override LC_MESSAGES
		os.Setenv("LC_ALL", "ja_JP")
		lang = getSystemLanguage()
		base, _ = lang.Base()
		assert.Equal(t, "ja", base.String())
		region, _ = lang.Region()
		assert.Equal(t, "JP", region.String())
		os.Setenv("LC_ALL", "POSIX")
	}
}

func TestLocalSprintf(t *testing.T) {
	var testTranslations = `
zh_Hans:
  hello: "TestLocalSprintf你好 %s"
  world: "TestLocalSprintf世界"
en_US:
  hello: "TestLocalSprintfHello %s"
  world: "TestLocalSprintfWorld"
ja_JP:
  hello: "TestLocalSprintfこんにちは %s"
  world: "TestLocalSprintf世界"
`
	// read translations
	readTranslations(testTranslations)

	type testCase struct {
		lang string
		want string
	}

	testCases := []testCase{
		{
			lang: "zh_CN",
			want: "TestLocalSprintf你好 TestLocalSprintf世界",
		},
		{
			lang: "zh_SG",
			want: "TestLocalSprintf你好 TestLocalSprintf世界",
		},
		{
			lang: "en_US",
			want: "TestLocalSprintfHello TestLocalSprintfWorld",
		},
		{
			lang: "ja_JP",
			want: "TestLocalSprintfこんにちは TestLocalSprintf世界",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.lang, func(t *testing.T) {
			SetLocalLanguage(language.MustParse(testCase.lang))
			assert.Equal(t, testCase.want, L("hello", L("world")))
		})
	}
}
