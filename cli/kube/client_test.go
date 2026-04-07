package kube

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
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

// ── WaitForDaemonSetsSettled ──────────────────────────────────────────────────

func settledDaemonSet(name string, labels map[string]string, desired int32, ready bool) appsv1.DaemonSet {
	numberReady := int32(0)
	if ready {
		numberReady = desired
	}
	return appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
			Labels:    labels,
			Generation: 3,
		},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: desired,
			CurrentNumberScheduled: desired,
			UpdatedNumberScheduled: desired,
			NumberReady:            numberReady,
			ObservedGeneration:     3,
		},
	}
}

func TestWaitForDaemonSetsSettled_ReadyPolicySatisfied(t *testing.T) {
	ds := settledDaemonSet("image-prepull", map[string]string{"app": "prepull"}, 1, true)
	cs := fake.NewSimpleClientset(&ds)
	c := clientFromFake(cs)
	err := c.WaitForDaemonSetsSettled(context.Background(), "default", "app=prepull", 10*time.Second, true, nil)
	assert.NoError(t, err)
}

func TestWaitForDaemonSetsSettled_ScheduledPolicySatisfiedWhenNotReady(t *testing.T) {
	ds := settledDaemonSet("image-prepull", map[string]string{"app": "prepull"}, 1, false)
	cs := fake.NewSimpleClientset(&ds)
	c := clientFromFake(cs)
	err := c.WaitForDaemonSetsSettled(context.Background(), "default", "app=prepull", 10*time.Second, false, nil)
	assert.NoError(t, err)
}

func TestWaitForDaemonSetsSettled_ReadyPolicyRequiresNumberReady(t *testing.T) {
	ds := settledDaemonSet("image-prepull", map[string]string{"app": "prepull"}, 1, false)
	cs := fake.NewSimpleClientset(&ds)
	c := clientFromFake(cs)
	err := c.WaitForDaemonSetsSettled(context.Background(), "default", "app=prepull", 1*time.Millisecond, true, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestWaitForDaemonSetsSettled_RequiresObservedGenerationCaughtUp(t *testing.T) {
	ds := settledDaemonSet("image-prepull", map[string]string{"app": "prepull"}, 1, true)
	ds.Status.ObservedGeneration = ds.Generation - 1
	cs := fake.NewSimpleClientset(&ds)
	c := clientFromFake(cs)
	err := c.WaitForDaemonSetsSettled(context.Background(), "default", "app=prepull", 1*time.Millisecond, true, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestWaitForDaemonSetsSettled_ReporterIsCalled(t *testing.T) {
	ds := settledDaemonSet("image-prepull", map[string]string{"app": "prepull"}, 1, true)
	cs := fake.NewSimpleClientset(&ds)
	c := clientFromFake(cs)

	called := 0
	var lastDS []appsv1.DaemonSet
	reporter := func(daemonSets []appsv1.DaemonSet) {
		called++
		lastDS = daemonSets
	}
	err := c.WaitForDaemonSetsSettled(context.Background(), "default", "app=prepull", 10*time.Second, true, reporter)
	require.NoError(t, err)
	assert.Greater(t, called, 0, "reporter should have been called at least once")
	assert.Len(t, lastDS, 1)
	assert.Equal(t, "image-prepull", lastDS[0].Name)
}

// ── isImagePullFailureReason ──────────────────────────────────────────────────

func TestIsImagePullFailureReason_ImagePullBackOff(t *testing.T) {
	s := corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ImagePullBackOff"}}
	assert.True(t, isImagePullFailureReason(s))
}

func TestIsImagePullFailureReason_ErrImagePull(t *testing.T) {
	s := corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ErrImagePull"}}
	assert.True(t, isImagePullFailureReason(s))
}

func TestIsImagePullFailureReason_CrashLoopBackOff(t *testing.T) {
	s := corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}}
	assert.True(t, isImagePullFailureReason(s))
}

func TestIsImagePullFailureReason_UnrelatedReason(t *testing.T) {
	s := corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ContainerCreating"}}
	assert.False(t, isImagePullFailureReason(s))
}

func TestIsImagePullFailureReason_NotWaiting(t *testing.T) {
	s := corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}
	assert.False(t, isImagePullFailureReason(s))
}

// ── podHasImagePullFailure ────────────────────────────────────────────────────

func waitingContainerState(reason string) corev1.ContainerState {
	return corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: reason}}
}

func TestPodHasImagePullFailure_PodFailed(t *testing.T) {
	pod := corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodFailed}}
	assert.True(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_InitContainerImagePullBackOff(t *testing.T) {
	pod := corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodPending,
		InitContainerStatuses: []corev1.ContainerStatus{
			{Name: "prepull", State: waitingContainerState("ImagePullBackOff")},
		},
	}}
	assert.True(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_InitContainerErrImagePull(t *testing.T) {
	pod := corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodPending,
		InitContainerStatuses: []corev1.ContainerStatus{
			{Name: "prepull", State: waitingContainerState("ErrImagePull")},
		},
	}}
	assert.True(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_RegularContainerImagePullBackOff(t *testing.T) {
	pod := corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodPending,
		ContainerStatuses: []corev1.ContainerStatus{
			{Name: "hold", State: waitingContainerState("ImagePullBackOff")},
		},
	}}
	assert.True(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_InitContainerCrashLoopBackOff(t *testing.T) {
	pod := corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodRunning,
		InitContainerStatuses: []corev1.ContainerStatus{
			{Name: "prepull", State: waitingContainerState("CrashLoopBackOff")},
		},
	}}
	assert.True(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_HealthyRunningPod(t *testing.T) {
	pod := runningReadyPod("p1")
	assert.False(t, podHasImagePullFailure(pod))
}

func TestPodHasImagePullFailure_PendingNoContainerStatuses(t *testing.T) {
	pod := pendingPod("p1")
	assert.False(t, podHasImagePullFailure(pod))
}

// ── HasPodsWithImagePullFailure ───────────────────────────────────────────────

func labeledPod(name string, labels map[string]string) corev1.Pod {
	p := runningReadyPod(name)
	p.Labels = labels
	return p
}

func imagePullBackOffPod(name string, labels map[string]string) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default", Labels: labels},
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
			InitContainerStatuses: []corev1.ContainerStatus{
				{Name: "prepull", State: waitingContainerState("ImagePullBackOff")},
			},
		},
	}
}

func TestHasPodsWithImagePullFailure_NoPods(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	has, err := c.HasPodsWithImagePullFailure(context.Background(), "default", "app=prepull")
	require.NoError(t, err)
	assert.False(t, has)
}

func TestHasPodsWithImagePullFailure_AllPodsHealthy(t *testing.T) {
	p1 := labeledPod("p1", map[string]string{"app": "prepull"})
	p2 := labeledPod("p2", map[string]string{"app": "prepull"})
	cs := fake.NewSimpleClientset(&p1, &p2)
	c := clientFromFake(cs)
	has, err := c.HasPodsWithImagePullFailure(context.Background(), "default", "app=prepull")
	require.NoError(t, err)
	assert.False(t, has)
}

func TestHasPodsWithImagePullFailure_OnePodWithImagePullBackOff(t *testing.T) {
	good := labeledPod("good", map[string]string{"app": "prepull"})
	bad := imagePullBackOffPod("bad", map[string]string{"app": "prepull"})
	cs := fake.NewSimpleClientset(&good, &bad)
	c := clientFromFake(cs)
	has, err := c.HasPodsWithImagePullFailure(context.Background(), "default", "app=prepull")
	require.NoError(t, err)
	assert.True(t, has)
}

func TestHasPodsWithImagePullFailure_LabelSelectorIgnoresOtherPods(t *testing.T) {
	// pod with a different label but in bad state — must not be detected
	unrelated := imagePullBackOffPod("unrelated", map[string]string{"app": "other"})
	cs := fake.NewSimpleClientset(&unrelated)
	c := clientFromFake(cs)
	has, err := c.HasPodsWithImagePullFailure(context.Background(), "default", "app=prepull")
	require.NoError(t, err)
	assert.False(t, has)
}

func TestHasPodsWithImagePullFailure_FailedPhaseCounts(t *testing.T) {
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "failed-pod", Namespace: "default", Labels: map[string]string{"app": "prepull"}},
		Status:     corev1.PodStatus{Phase: corev1.PodFailed},
	}
	cs := fake.NewSimpleClientset(&pod)
	c := clientFromFake(cs)
	has, err := c.HasPodsWithImagePullFailure(context.Background(), "default", "app=prepull")
	require.NoError(t, err)
	assert.True(t, has)
}

// ── DeletePodsByLabel ─────────────────────────────────────────────────────────

func TestDeletePodsByLabel_DeletesMatchingPods(t *testing.T) {
	p1 := labeledPod("p1", map[string]string{"app": "prepull"})
	p2 := labeledPod("p2", map[string]string{"app": "prepull"})
	cs := fake.NewSimpleClientset(&p1, &p2)
	c := clientFromFake(cs)

	err := c.DeletePodsByLabel(context.Background(), "default", "app=prepull")
	require.NoError(t, err)

	remaining, _ := cs.CoreV1().Pods("default").List(context.Background(), metav1.ListOptions{})
	assert.Empty(t, remaining.Items)
}

func TestDeletePodsByLabel_LeavesNonMatchingPodsUntouched(t *testing.T) {
	target := labeledPod("target", map[string]string{"app": "prepull"})
	other := labeledPod("other", map[string]string{"app": "keeper"})
	cs := fake.NewSimpleClientset(&target, &other)
	c := clientFromFake(cs)

	err := c.DeletePodsByLabel(context.Background(), "default", "app=prepull")
	require.NoError(t, err)

	remaining, _ := cs.CoreV1().Pods("default").List(context.Background(), metav1.ListOptions{})
	require.Len(t, remaining.Items, 1)
	assert.Equal(t, "other", remaining.Items[0].Name)
}

func TestDeletePodsByLabel_NoPodsIsNoop(t *testing.T) {
	cs := fake.NewSimpleClientset()
	c := clientFromFake(cs)
	err := c.DeletePodsByLabel(context.Background(), "default", "app=prepull")
	assert.NoError(t, err)
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
