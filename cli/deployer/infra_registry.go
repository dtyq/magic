package deployer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"text/template"

	"github.com/dtyq/magicrew-cli/util"
	"github.com/sethvargo/go-password/password"
	"go.yaml.in/yaml/v3"
)

// InfraKind identifies the type of infrastructure resource.
type InfraKind string

const (
	KindMySQL    InfraKind = "mysql"
	KindRabbitMQ InfraKind = "rabbitmq"
	KindRedis    InfraKind = "redis"
	KindMinIO    InfraKind = "minio"
)

// InfraSpec is a sealed interface. Only concrete types in this package implement it,
// preventing external packages from accidentally registering unknown resource kinds.
type InfraSpec interface {
	infraKind() InfraKind
}

// Concrete Spec types. Requesting applications fill these in; no password fields.

// MySQLSpec requests a MySQL database and user.
type MySQLSpec struct{ Database, Username string }

// RabbitMQSpec requests a RabbitMQ vhost and user.
type RabbitMQSpec struct{ VHost, Username, Tags string }

// RedisSpec requests a Redis ACL user.
// ACLRules follows Redis ACL syntax, e.g. "+@all ~* &*".
type RedisSpec struct{ Username, ACLRules string }

// MinIOPolicyStatement is one statement in a named MinIO IAM policy.
type MinIOPolicyStatement struct {
	Resources []string `yaml:"resources"`
	Effect    string   `yaml:"effect"`
	Actions   []string `yaml:"actions"`
}

// MinIOPolicy is a named policy definition for MinIO provisioning (caller-declared).
type MinIOPolicy struct {
	Name       string                 `yaml:"name"`
	Statements []MinIOPolicyStatement `yaml:"statements"`
}

// MinIOSpec requests a MinIO user with named policies.
type MinIOSpec struct {
	Username          string
	Policies          []string
	Buckets           []MinIOBucket
	PolicyDefinitions []MinIOPolicy
}

func (MySQLSpec) infraKind() InfraKind    { return KindMySQL }
func (RabbitMQSpec) infraKind() InfraKind { return KindRabbitMQ }
func (RedisSpec) infraKind() InfraKind    { return KindRedis }
func (MinIOSpec) infraKind() InfraKind    { return KindMinIO }

// InfraResource is the unit of registration: which app needs which resource.
type InfraResource struct {
	App  string    // requesting application name, e.g. "magic", "magic-sandbox"
	Spec InfraSpec // resource specification (no password)
}

// ── Unified credential types ──────────────────────────────────────────────────
// These types serve triple duty: runtime state, YAML persistence, and template data.
// Unexported fields in InfraRegistry are skipped by go-yaml automatically.

// MySQLCreds holds MySQL root credential and all registered app users.
type MySQLCreds struct {
	RootPassword string      `yaml:"rootPassword"`
	Users        []MySQLUser `yaml:"users"`
}

// MySQLUser is one MySQL app account with its associated database.
type MySQLUser struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
}

// InitSQL returns the MySQL init script that creates all registered users and
// databases. The result uses 6-space indentation per line, ready for embedding
// in the YAML block scalar used by charts/infra/values.tmpl.
func (c MySQLCreds) InitSQL() string {
	var b strings.Builder
	for _, u := range c.Users {
		escapedPwd := strings.ReplaceAll(u.Password, "'", "''")
		fmt.Fprintf(&b, "      CREATE DATABASE IF NOT EXISTS `%s`;\n", u.Database)
		fmt.Fprintf(&b, "      CREATE USER IF NOT EXISTS '%s'@'%%' IDENTIFIED BY '%s';\n", u.Username, escapedPwd)
		fmt.Fprintf(&b, "      GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'%%';\n", u.Database, u.Username)
	}
	b.WriteString("      FLUSH PRIVILEGES;")
	return b.String()
}

// RedisCreds holds Redis admin credential and all registered ACL users.
type RedisCreds struct {
	AdminPassword string      `yaml:"adminPassword"`
	Users         []RedisUser `yaml:"users"`
}

// RedisUser is one Redis ACL account.
type RedisUser struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	ACLRules string `yaml:"aclRules"`
}

// RabbitMQCreds holds RabbitMQ admin credential and all registered app users.
type RabbitMQCreds struct {
	AdminPassword string         `yaml:"adminPassword"`
	Users         []RabbitMQUser `yaml:"users"`
}

// RabbitMQUser is one RabbitMQ account with vhost and management tags.
type RabbitMQUser struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	VHost    string `yaml:"vhost"`
	Tags     string `yaml:"tags"`
}

// LoadDefinitionJSON serialises the RabbitMQ load-definition payload (users,
// vhosts, permissions) to JSON. Called directly from charts/infra/values.tmpl;
// Go templates propagate non-nil errors returned by methods.
func (c RabbitMQCreds) LoadDefinitionJSON() (string, error) {
	type rmqUser struct {
		Name     string `json:"name"`
		Password string `json:"password"`
		Tags     string `json:"tags"`
	}
	type rmqVHost struct {
		Name string `json:"name"`
	}
	type rmqPerm struct {
		User      string `json:"user"`
		VHost     string `json:"vhost"`
		Configure string `json:"configure"`
		Write     string `json:"write"`
		Read      string `json:"read"`
	}
	type def struct {
		Users       []rmqUser  `json:"users"`
		VHosts      []rmqVHost `json:"vhosts"`
		Permissions []rmqPerm  `json:"permissions"`
	}

	d := def{}
	vhostSeen := map[string]bool{}
	for _, u := range c.Users {
		d.Users = append(d.Users, rmqUser{Name: u.Username, Password: u.Password, Tags: u.Tags})
		if !vhostSeen[u.VHost] {
			vhostSeen[u.VHost] = true
			d.VHosts = append(d.VHosts, rmqVHost{Name: u.VHost})
		}
		d.Permissions = append(d.Permissions, rmqPerm{
			User: u.Username, VHost: u.VHost,
			Configure: ".*", Write: ".*", Read: ".*",
		})
	}
	raw, err := json.Marshal(d)
	if err != nil {
		return "", fmt.Errorf("marshal rabbitmq load definition: %w", err)
	}
	return string(raw), nil
}

// MinioCreds holds MinIO root credential and all registered app users.
type MinioCreds struct {
	RootPassword string        `yaml:"rootPassword"`
	Users        []MinIOUser   `yaml:"users"`
	Buckets      []MinIOBucket `yaml:"buckets"`
	Policies     []MinIOPolicy `yaml:"policies"`
}

// MinIOUser is one MinIO account with its policy list.
type MinIOUser struct {
	Username string   `yaml:"username"`
	Password string   `yaml:"password"`
	Policies []string `yaml:"policies"`
}

// MinIOBucket is one MinIO provisioning bucket entry.
type MinIOBucket struct {
	Name       string            `yaml:"name"`
	Region     string            `yaml:"region"`
	Versioning string            `yaml:"versioning"`
	WithLock   bool              `yaml:"withLock"`
	Tags       map[string]string `yaml:"tags"`
}

// ── Credential types returned by the typed Getters ──────────────────────────

// MySQLCredential holds app-level MySQL auth details (no endpoint).
type MySQLCredential struct{ Username, Password, Database string }

// RabbitMQCredential holds app-level RabbitMQ auth details.
type RabbitMQCredential struct{ Username, Password, VHost string }

// RedisCredential holds app-level Redis auth details.
type RedisCredential struct{ Username, Password string }

// MinIOCredential holds app-level MinIO auth details.
type MinIOCredential struct{ Username, Password string }

// ── InfraRegistry ────────────────────────────────────────────────────────────

// InfraRegistry collects resource requests from services and resolves
// credentials (loading persisted values or generating new ones).
//
// The exported fields (MySQL, Redis, RabbitMQ, MinIO) serve triple duty:
//  1. Runtime credential store (after ResolveCredentials).
//  2. YAML persistence — yaml.Marshal(r) / yaml.Unmarshal(data, r) directly,
//     because go-yaml skips unexported fields automatically.
//  3. Template data — passed directly to charts/infra/values.tmpl; methods on
//     the Creds types (InitSQL, LoadDefinitionJSON) are callable from templates.
type InfraRegistry struct {
	MySQL    MySQLCreds    `yaml:"mysql"`
	Redis    RedisCreds    `yaml:"redis"`
	RabbitMQ RabbitMQCreds `yaml:"rabbitmq"`
	MinIO    MinioCreds    `yaml:"minio"`

	// resources[app][kind] = spec; at most one spec per (app, kind).
	// Unexported → skipped by go-yaml automatically.
	resources       map[string]map[InfraKind]InfraSpec
	persistPathFunc func() (string, error)
}

func newInfraRegistry() *InfraRegistry {
	return &InfraRegistry{
		resources:       map[string]map[InfraKind]InfraSpec{},
		persistPathFunc: defaultInfraCredentialsPath,
	}
}

// Register records one or more resource requests. Typically called in a
// Stage's constructor so all registrations are complete before InfraStage runs.
// A later call for the same (app, kind) pair overwrites the earlier registration.
func (r *InfraRegistry) Register(resources ...InfraResource) {
	for _, res := range resources {
		if r.resources[res.App] == nil {
			r.resources[res.App] = map[InfraKind]InfraSpec{}
		}
		r.resources[res.App][res.Spec.infraKind()] = res.Spec
	}
}

// ── Typed Getters (call after ResolveCredentials) ────────────────────────────
// Note: getter methods are prefixed with "Get" to avoid a naming conflict with
// the exported credential fields (MySQL, Redis, RabbitMQ, MinIO) that serve as
// the YAML persistence / template-data backing store.

// GetMySQL returns the credential for the MySQLSpec registered by the given app.
func (r *InfraRegistry) GetMySQL(app string) MySQLCredential {
	spec, ok := r.resources[app][KindMySQL]
	if !ok {
		return MySQLCredential{}
	}
	username := spec.(MySQLSpec).Username
	for _, u := range r.MySQL.Users {
		if u.Username == username {
			return MySQLCredential{Username: u.Username, Password: u.Password, Database: u.Database}
		}
	}
	return MySQLCredential{}
}

// GetRabbitMQ returns the credential for the RabbitMQSpec registered by the given app.
func (r *InfraRegistry) GetRabbitMQ(app string) RabbitMQCredential {
	spec, ok := r.resources[app][KindRabbitMQ]
	if !ok {
		return RabbitMQCredential{}
	}
	username := spec.(RabbitMQSpec).Username
	for _, u := range r.RabbitMQ.Users {
		if u.Username == username {
			return RabbitMQCredential{Username: u.Username, Password: u.Password, VHost: u.VHost}
		}
	}
	return RabbitMQCredential{}
}

// GetRedis returns the credential for the RedisSpec registered by the given app.
func (r *InfraRegistry) GetRedis(app string) RedisCredential {
	spec, ok := r.resources[app][KindRedis]
	if !ok {
		return RedisCredential{}
	}
	username := spec.(RedisSpec).Username
	// App-side Redis auth is unified to the infra admin password for now.
	// ACL users are still persisted/rendered so we can switch to username-based auth later.
	return RedisCredential{Username: username, Password: r.Redis.AdminPassword}
}

// GetMinIO returns the credential for the MinIOSpec registered by the given app.
func (r *InfraRegistry) GetMinIO(app string) (MinIOCredential, error) {
	spec, ok := r.resources[app][KindMinIO]
	if !ok {
		return MinIOCredential{}, fmt.Errorf("minio registration not found for app %q", app)
	}
	username := spec.(MinIOSpec).Username
	for _, u := range r.MinIO.Users {
		if u.Username == username {
			return MinIOCredential{Username: u.Username, Password: u.Password}, nil
		}
	}
	return MinIOCredential{}, fmt.Errorf("minio registration not found for app %q", app)
}

// ── Credential Resolution ────────────────────────────────────────────────────

// ResolveCredentials loads persisted credentials, generates any that are
// missing, and writes the complete set back to disk. Must be called before
// any Getter or RenderOverlay.
func (r *InfraRegistry) ResolveCredentials() error {
	path, err := r.loadPersisted()
	if err != nil {
		return err
	}

	gen := func(stored string) (string, error) {
		if stored != "" {
			return stored, nil
		}
		return generateInfraPassword()
	}

	// Root / admin passwords.
	if r.MySQL.RootPassword, err = gen(r.MySQL.RootPassword); err != nil {
		return fmt.Errorf("mysql root password: %w", err)
	}
	if r.RabbitMQ.AdminPassword, err = gen(r.RabbitMQ.AdminPassword); err != nil {
		return fmt.Errorf("rabbitmq admin password: %w", err)
	}
	if r.Redis.AdminPassword, err = gen(r.Redis.AdminPassword); err != nil {
		return fmt.Errorf("redis admin password: %w", err)
	}
	if r.MinIO.RootPassword, err = gen(r.MinIO.RootPassword); err != nil {
		return fmt.Errorf("minio root password: %w", err)
	}

	// Per-user credentials: merge registered specs with persisted users.
	r.MySQL.Users, err = resolveUsers(r.resources, KindMySQL, r.MySQL.Users, gen,
		func(spec InfraSpec, pwd string) MySQLUser {
			s := spec.(MySQLSpec)
			return MySQLUser{Username: s.Username, Password: pwd, Database: s.Database}
		},
		func(u MySQLUser) string { return u.Username },
		func(u MySQLUser) string { return u.Password },
	)
	if err != nil {
		return fmt.Errorf("mysql users: %w", err)
	}

	r.RabbitMQ.Users, err = resolveUsers(r.resources, KindRabbitMQ, r.RabbitMQ.Users, gen,
		func(spec InfraSpec, pwd string) RabbitMQUser {
			s := spec.(RabbitMQSpec)
			return RabbitMQUser{Username: s.Username, Password: pwd, VHost: s.VHost, Tags: s.Tags}
		},
		func(u RabbitMQUser) string { return u.Username },
		func(u RabbitMQUser) string { return u.Password },
	)
	if err != nil {
		return fmt.Errorf("rabbitmq users: %w", err)
	}

	r.Redis.Users, err = resolveUsers(r.resources, KindRedis, r.Redis.Users, gen,
		func(spec InfraSpec, pwd string) RedisUser {
			s := spec.(RedisSpec)
			return RedisUser{Username: s.Username, Password: pwd, ACLRules: s.ACLRules}
		},
		func(u RedisUser) string { return u.Username },
		func(u RedisUser) string { return u.Password },
	)
	if err != nil {
		return fmt.Errorf("redis users: %w", err)
	}

	policies, err := collectMinIOPoliciesFromSpecs(r.resources)
	if err != nil {
		return fmt.Errorf("minio policies: %w", err)
	}
	if err := validateMinIOPolicyReferences(r.resources, policies); err != nil {
		return fmt.Errorf("minio policy references: %w", err)
	}
	r.MinIO.Policies = policies

	r.MinIO.Users, err = resolveUsers(r.resources, KindMinIO, r.MinIO.Users, gen,
		func(spec InfraSpec, pwd string) MinIOUser {
			s := spec.(MinIOSpec)
			return MinIOUser{Username: s.Username, Password: pwd, Policies: s.Policies}
		},
		func(u MinIOUser) string { return u.Username },
		func(u MinIOUser) string { return u.Password },
	)
	if err != nil {
		return fmt.Errorf("minio users: %w", err)
	}
	r.MinIO.Buckets = collectMinIOBucketsFromSpecs(r.resources)

	return r.savePersisted(path)
}

func collectMinIOBucketsFromSpecs(resources map[string]map[InfraKind]InfraSpec) []MinIOBucket {
	apps := make([]string, 0, len(resources))
	for app := range resources {
		apps = append(apps, app)
	}
	sort.Strings(apps)

	byName := map[string]MinIOBucket{}
	for _, app := range apps {
		spec, ok := resources[app][KindMinIO]
		if !ok {
			continue
		}
		for _, bucket := range spec.(MinIOSpec).Buckets {
			if strings.TrimSpace(bucket.Name) == "" {
				continue
			}
			byName[bucket.Name] = bucket
		}
	}
	names := make([]string, 0, len(byName))
	for name := range byName {
		names = append(names, name)
	}
	sort.Strings(names)

	out := make([]MinIOBucket, 0, len(names))
	for _, name := range names {
		out = append(out, byName[name])
	}
	return out
}

// collectMinIOPoliciesFromSpecs merges MinIOSpec.PolicyDefinitions across apps.
// Policy names must be non-empty, unique per spec and globally; statements must
// have non-empty resources and actions. Output is sorted by policy name.
func collectMinIOPoliciesFromSpecs(resources map[string]map[InfraKind]InfraSpec) ([]MinIOPolicy, error) {
	apps := make([]string, 0, len(resources))
	for app := range resources {
		apps = append(apps, app)
	}
	sort.Strings(apps)

	byName := make(map[string]MinIOPolicy)
	ownerApp := make(map[string]string)

	for _, app := range apps {
		appSpecs := resources[app]
		spec, ok := appSpecs[KindMinIO]
		if !ok {
			continue
		}
		minio := spec.(MinIOSpec)
		seenInSpec := make(map[string]bool)
		for _, pol := range minio.PolicyDefinitions {
			name := strings.TrimSpace(pol.Name)
			if name == "" {
				return nil, fmt.Errorf("app %q: minio policy name is empty", app)
			}
			if seenInSpec[name] {
				return nil, fmt.Errorf("app %q: duplicate minio policy %q in PolicyDefinitions", app, name)
			}
			seenInSpec[name] = true

			normalizedStmts, err := normalizeAndValidateMinIOPolicyStatements(app, name, pol.Statements)
			if err != nil {
				return nil, err
			}

			normalized := MinIOPolicy{Name: name, Statements: normalizedStmts}
			if first, dup := ownerApp[name]; dup {
				return nil, fmt.Errorf("minio policy %q: conflicting definitions in app %q and app %q", name, first, app)
			}
			byName[name] = normalized
			ownerApp[name] = app
		}
	}

	names := make([]string, 0, len(byName))
	for n := range byName {
		names = append(names, n)
	}
	sort.Strings(names)

	out := make([]MinIOPolicy, 0, len(names))
	for _, n := range names {
		out = append(out, byName[n])
	}
	return out, nil
}

// validateMinIOPolicyReferences ensures each MinIOSpec.Policies entry names a
// collected policy definition.
func validateMinIOPolicyReferences(resources map[string]map[InfraKind]InfraSpec, policies []MinIOPolicy) error {
	defined := make(map[string]bool, len(policies))
	for _, p := range policies {
		defined[strings.TrimSpace(p.Name)] = true
	}

	apps := make([]string, 0, len(resources))
	for app := range resources {
		apps = append(apps, app)
	}
	sort.Strings(apps)

	for _, app := range apps {
		spec, ok := resources[app][KindMinIO]
		if !ok {
			continue
		}
		minio := spec.(MinIOSpec)
		for _, ref := range minio.Policies {
			rname := strings.TrimSpace(ref)
			if rname == "" {
				return fmt.Errorf("app %q: minio policy reference name is empty", app)
			}
			if !defined[rname] {
				return fmt.Errorf("app %q: minio policy %q is not defined", app, rname)
			}
		}
	}
	return nil
}

// resolveUsers merges persisted users with newly registered specs, generating
// passwords for any that are not yet persisted. Generic over the user type T.
// It iterates resources to collect all specs of the given kind, deduplicating
// by username in case multiple apps registered the same username.
func resolveUsers[T any](
	resources map[string]map[InfraKind]InfraSpec,
	kind InfraKind,
	existing []T,
	gen func(string) (string, error),
	build func(InfraSpec, string) T,
	username func(T) string,
	password func(T) string,
) ([]T, error) {
	stored := map[string]string{}
	for _, u := range existing {
		stored[username(u)] = password(u)
	}

	var out []T
	seen := map[string]bool{}
	for _, appSpecs := range resources {
		spec, ok := appSpecs[kind]
		if !ok {
			continue
		}
		name := infraSpecUsername(spec)
		if seen[name] {
			continue
		}
		seen[name] = true
		pwd, err := gen(stored[name])
		if err != nil {
			return nil, fmt.Errorf("password for %q: %w", name, err)
		}
		out = append(out, build(spec, pwd))
	}
	return out, nil
}

func infraSpecUsername(s InfraSpec) string {
	switch v := s.(type) {
	case MySQLSpec:
		return v.Username
	case RabbitMQSpec:
		return v.Username
	case RedisSpec:
		return v.Username
	case MinIOSpec:
		return v.Username
	default:
		return ""
	}
}

// ── Template Rendering ───────────────────────────────────────────────────────

// RenderOverlay renders the Go template at tmplPath with r as template data
// and returns a map[string]interface{} suitable for deep-merging into the infra
// chart values (the result is at the chart-level, e.g. {mysql: ..., redis: ...}).
func (r *InfraRegistry) RenderOverlay(tmplPath string) (map[string]interface{}, error) {
	raw, err := os.ReadFile(tmplPath)
	if err != nil {
		return nil, fmt.Errorf("read infra values template %s: %w", tmplPath, err)
	}
	return r.RenderOverlayFromBytes(raw)
}

// RenderOverlayFromBytes renders the Go template from raw content with r as template data.
// This is the core implementation used by both RenderOverlay (local file) and remote chart sources.
//
// r is passed directly as template data; no intermediate struct is needed because
// the exported Creds fields match the template's field paths exactly, and derived
// values (InitSQL, LoadDefinitionJSON) are methods callable from the template.
func (r *InfraRegistry) RenderOverlayFromBytes(raw []byte) (map[string]interface{}, error) {
	funcMap := template.FuncMap{
		// quote wraps a string in YAML-safe double quotes.
		"quote": func(s string) string {
			s = strings.ReplaceAll(s, `\`, `\\`)
			s = strings.ReplaceAll(s, `"`, `\"`)
			return `"` + s + `"`
		},
		// escapeSQ doubles single quotes for SQL string literals.
		"escapeSQ": func(s string) string { return strings.ReplaceAll(s, "'", "''") },
	}

	tmpl, err := template.New("infra-values").Funcs(funcMap).Parse(string(raw))
	if err != nil {
		return nil, fmt.Errorf("parse infra values template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, r); err != nil {
		return nil, fmt.Errorf("render infra values template: %w", err)
	}

	var overlay map[string]interface{}
	if err := yaml.Unmarshal(buf.Bytes(), &overlay); err != nil {
		return nil, fmt.Errorf("parse rendered infra values: %w", err)
	}
	if overlay == nil {
		overlay = map[string]interface{}{}
	}
	return overlay, nil
}

// ── Persistence ──────────────────────────────────────────────────────────────

const infraCredentialsFileName = "infra-credentials.yaml"

// loadPersisted reads the credentials file into r's exported fields (MySQL,
// Redis, RabbitMQ, MinIO). Returns the resolved file path for later saving.
// If the file does not exist yet, r is left unchanged and no error is returned.
func (r *InfraRegistry) loadPersisted() (string, error) {
	path, err := r.persistPathFunc()
	if err != nil {
		return "", fmt.Errorf("resolve infra credentials path: %w", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return path, nil
		}
		return "", fmt.Errorf("read infra credentials %s: %w", path, err)
	}
	if err := yaml.Unmarshal(data, r); err != nil {
		return "", fmt.Errorf("parse infra credentials %s: %w", path, err)
	}
	return path, nil
}

// savePersisted marshals r's exported fields to YAML and writes them to path.
// go-yaml skips unexported fields (resources, persistPathFunc) automatically.
func (r *InfraRegistry) savePersisted(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create infra credentials dir: %w", err)
	}
	raw, err := yaml.Marshal(r)
	if err != nil {
		return fmt.Errorf("marshal infra credentials: %w", err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return fmt.Errorf("write infra credentials %s: %w", path, err)
	}
	return nil
}

func defaultInfraCredentialsPath() (string, error) {
	type result struct {
		path string
		err  error
	}
	r := util.NoSudo(func() result {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return result{err: fmt.Errorf("get user home dir: %w", err)}
		}
		return result{path: filepath.Join(homeDir, ".config", "magicrew", infraCredentialsFileName)}
	})
	return r.path, r.err
}

// generateInfraPassword generates a 24-character cryptographically secure
// password via github.com/sethvargo/go-password (uses crypto/rand internally).
func generateInfraPassword() (string, error) {
	// 24 chars: 4 digits, 0 symbols, mixed case, repeats allowed.
	return password.Generate(24, 4, 0, false, true)
}

var (
	minIOIAMActionPattern     = regexp.MustCompile(`^s3:[A-Za-z0-9*]+$`)
	minIOS3ResourceARNPattern = regexp.MustCompile(`^arn:aws:s3:::[^/\s]+(?:/\*)?$`)
)

// normalizeMinIOPolicyStringList trims entries, drops empties, dedupes preserving first occurrence order.
func normalizeMinIOPolicyStringList(xs []string) []string {
	seen := make(map[string]bool, len(xs))
	out := make([]string, 0, len(xs))
	for _, x := range xs {
		t := strings.TrimSpace(x)
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
	}
	return out
}

// normalizeAndValidateMinIOPolicyStatements returns statements with normalized effect, actions, and resources.
func normalizeAndValidateMinIOPolicyStatements(app, policyName string, stmts []MinIOPolicyStatement) ([]MinIOPolicyStatement, error) {
	if len(stmts) == 0 {
		return nil, fmt.Errorf(`app %q policy %q: at least one statement is required`, app, policyName)
	}
	out := make([]MinIOPolicyStatement, 0, len(stmts))
	for i, st := range stmts {
		eff := strings.TrimSpace(st.Effect)
		var normEff string
		switch {
		case strings.EqualFold(eff, "allow"):
			normEff = "Allow"
		case strings.EqualFold(eff, "deny"):
			normEff = "Deny"
		default:
			return nil, fmt.Errorf(`app %q policy %q statement %d: effect must be Allow or Deny`, app, policyName, i)
		}

		actions := normalizeMinIOPolicyStringList(st.Actions)
		if len(actions) == 0 {
			return nil, fmt.Errorf(`app %q policy %q statement %d: actions must include at least one non-empty entry`, app, policyName, i)
		}
		for _, a := range actions {
			if !minIOIAMActionPattern.MatchString(a) {
				return nil, fmt.Errorf(`app %q policy %q statement %d: invalid action %q`, app, policyName, i, a)
			}
		}

		resources := normalizeMinIOPolicyStringList(st.Resources)
		if len(resources) == 0 {
			return nil, fmt.Errorf(`app %q policy %q statement %d: resources must include at least one non-empty entry`, app, policyName, i)
		}
		for _, r := range resources {
			if !minIOS3ResourceARNPattern.MatchString(r) {
				return nil, fmt.Errorf(`app %q policy %q statement %d: invalid resource arn %q`, app, policyName, i, r)
			}
		}

		out = append(out, MinIOPolicyStatement{
			Effect:    normEff,
			Actions:   actions,
			Resources: resources,
		})
	}
	return out, nil
}
