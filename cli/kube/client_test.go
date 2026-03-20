package kube

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func runningReadyPod(name string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionTrue},
			},
		},
	}
}

func runningNotReadyPod(name string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionFalse},
			},
		},
	}
}

func pendingPod(name string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Status:     corev1.PodStatus{Phase: corev1.PodPending},
	}
}

func succeededPod(name string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Status:     corev1.PodStatus{Phase: corev1.PodSucceeded},
	}
}

// ── allReady ─────────────────────────────────────────────────────────────────

func TestAllReady_AllRunningAndReady(t *testing.T) {
	pods := []corev1.Pod{runningReadyPod("p1"), runningReadyPod("p2")}
	assert.True(t, allReady(pods))
}

func TestAllReady_PodPhasePending(t *testing.T) {
	pods := []corev1.Pod{runningReadyPod("p1"), pendingPod("p2")}
	assert.False(t, allReady(pods))
}

func TestAllReady_RunningButNotReady(t *testing.T) {
	pods := []corev1.Pod{runningReadyPod("p1"), runningNotReadyPod("p2")}
	assert.False(t, allReady(pods))
}

func TestAllReady_SucceededJobPodDoesNotBlock(t *testing.T) {
	pods := []corev1.Pod{runningReadyPod("p1"), succeededPod("job-pod")}
	assert.True(t, allReady(pods))
}

func TestAllReady_EmptyList(t *testing.T) {
	// no pods should not block: allReady returns true so WaitForPodsReady can return nil
	assert.True(t, allReady([]corev1.Pod{}))
}

// ── EnsureNamespace ──────────────────────────────────────────────────────────

func clientFromFake(cs *fake.Clientset) *Client {
	return &Client{cs: cs} // fake.Clientset implements kubernetes.Interface
}

func TestEnsureNamespace_CreatesWhenMissing(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	err := c.EnsureNamespace(context.Background(), "my-ns")
	require.NoError(t, err)
	ns, err := cs.CoreV1().Namespaces().Get(context.Background(), "my-ns", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "my-ns", ns.Name)
}

func TestEnsureNamespace_IdempotentWhenExists(t *testing.T) {
	existing := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "my-ns"}}
	cs := fake.NewSimpleClientset(existing)
	c := clientFromFake(cs)
	assert.NoError(t, c.EnsureNamespace(context.Background(), "my-ns"))
}

func TestGetService_ReturnsService(t *testing.T) {
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "svc-a", Namespace: "default"},
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{{Name: "http", Port: 80}},
		},
	}
	cs := fake.NewSimpleClientset(svc)
	c := clientFromFake(cs)
	got, err := c.GetService(context.Background(), "default", "svc-a")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "svc-a", got.Name)
}

func TestGetService_NotFoundReturnsError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	_, err := c.GetService(context.Background(), "default", "not-exist")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get service default/not-exist")
}

// ── WaitForPodsReady ─────────────────────────────────────────────────────────

func TestWaitForPodsReady_PodsAlreadyReady(t *testing.T) {
	pod := runningReadyPod("p1")
	pod.Labels = map[string]string{"app": "test"}
	cs := fake.NewSimpleClientset(&pod)
	c := clientFromFake(cs)
	err := c.WaitForPodsReady(context.Background(), "default", "app=test", 10*time.Second, nil)
	assert.NoError(t, err)
}

func TestWaitForPodsReady_TimeoutWhenNoPods(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	err := c.WaitForPodsReady(context.Background(), "default", "app=test", 1*time.Millisecond, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestWaitForPodsReady_ContextCancelledReturnsError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	err := c.WaitForPodsReady(ctx, "default", "app=test", 10*time.Second, nil)
	require.Error(t, err)
}

func TestWaitForPodsReady_ReporterIsCalled(t *testing.T) {
	pod := runningReadyPod("p1")
	pod.Labels = map[string]string{"app": "test"}
	cs := fake.NewSimpleClientset(&pod)
	c := clientFromFake(cs)

	called := 0
	var lastPods []corev1.Pod
	reporter := func(pods []corev1.Pod) {
		called++
		lastPods = pods
	}
	err := c.WaitForPodsReady(context.Background(), "default", "app=test", 10*time.Second, reporter)
	require.NoError(t, err)
	assert.Greater(t, called, 0, "reporter should have been called at least once")
	assert.Len(t, lastPods, 1)
	assert.Equal(t, "p1", lastPods[0].Name)
}

// ── RecreateStandardStorageClass ─────────────────────────────────────────────

func TestRecreateStandardStorageClass_CreatesWhenMissing(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	ctx := context.Background()

	err := c.RecreateStandardStorageClass(ctx)
	require.NoError(t, err)

	sc, err := cs.StorageV1().StorageClasses().Get(ctx, "standard", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "rancher.io/local-path", sc.Provisioner)
	assert.Equal(t, "true", sc.Annotations["storageclass.kubernetes.io/is-default-class"])
	assert.Equal(t, "true", sc.Annotations[standardStorageClassManagedAnnotation])
	assert.Equal(t, "true", sc.Parameters["allowUnsafePathPattern"])
	assert.Contains(t, sc.Parameters["pathPattern"], "volume-path")
	assert.Contains(t, sc.Parameters["pathPattern"], "PVC.Namespace")
	assert.Contains(t, sc.Parameters["pathPattern"], "PVC.Name")
}

func TestRecreateStandardStorageClass_ReplacesExisting(t *testing.T) {
	existing := &storagev1.StorageClass{
		ObjectMeta:  metav1.ObjectMeta{Name: "standard"},
		Provisioner: "old-provisioner",
	}
	cs := fake.NewSimpleClientset(existing)
	c := clientFromFake(cs)
	ctx := context.Background()

	err := c.RecreateStandardStorageClass(ctx)
	require.NoError(t, err)

	sc, err := cs.StorageV1().StorageClasses().Get(ctx, "standard", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "rancher.io/local-path", sc.Provisioner)
}

func TestRecreateStandardStorageClass_SkipsWhenAlreadyOurs(t *testing.T) {
	existing := &storagev1.StorageClass{
		ObjectMeta: metav1.ObjectMeta{
			Name: "standard",
			Annotations: map[string]string{
				"storageclass.kubernetes.io/is-default-class": "true",
				standardStorageClassManagedAnnotation:         "true",
			},
			Labels: map[string]string{"test-marker": "unchanged"},
		},
		Provisioner: "rancher.io/local-path",
	}
	cs := fake.NewSimpleClientset(existing)
	c := clientFromFake(cs)
	ctx := context.Background()

	err := c.RecreateStandardStorageClass(ctx)
	require.NoError(t, err)

	sc, err := cs.StorageV1().StorageClasses().Get(ctx, "standard", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "rancher.io/local-path", sc.Provisioner)
	assert.Equal(t, "unchanged", sc.Labels["test-marker"], "should not have replaced our StorageClass")
}

func TestRecreateStandardStorageClass_Idempotent(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	ctx := context.Background()

	err := c.RecreateStandardStorageClass(ctx)
	require.NoError(t, err)
	err = c.RecreateStandardStorageClass(ctx)
	require.NoError(t, err)

	sc, err := cs.StorageV1().StorageClasses().Get(ctx, "standard", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "rancher.io/local-path", sc.Provisioner)
}
