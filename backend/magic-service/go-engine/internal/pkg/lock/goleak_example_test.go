// Package lock_test 演示 goroutine 泄漏检测
//
// 这个文件展示了如何在测试中检测 goroutine 泄漏。
// TestMain 会在测试结束后检查是否有未关闭的 goroutine。
package lock_test

import (
	"testing"

	"go.uber.org/goleak"
)

// TestGoLeakExample_NoLeak 演示正常的测试，不会泄漏 goroutine
func TestGoLeakExample_NoLeak(t *testing.T) {
	defer goleak.VerifyNone(t)

	// 正常的测试逻辑，没有启动 goroutine 或者已经正确关闭
	t.Log("这个测试不会泄漏 goroutine")
}

// 如果取消注释下面的测试，会检测到 goroutine 泄漏
/*
func TestGoLeakExample_WithLeak(t *testing.T) {
	defer goleak.VerifyNone(t)

	// 这会导致 goroutine 泄漏，因为 goroutine 永远不会结束
	go func() {
		select {} // 永远阻塞
	}()

	t.Log("这个测试会泄漏一个 goroutine")
}
*/
