/**
 * Child processes should not inherit application secrets by default. Audit
 * tools parse attacker-influenced source, while local AI clients receive
 * attacker-influenced market/source text. Keep only runtime/tool discovery
 * settings; production AI uses the HTTPS API path instead.
 */
const ALLOWED_CHILD_ENV = [
  "PATH",
  "NODE_ENV",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "NO_COLOR",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "VIRTUAL_ENV",
  "PYENV_ROOT",
  "PYENV_VERSION",
  "SOLC_SELECT_DIR",
  "CARGO_HOME",
  "RUSTUP_HOME",
  // Windows process discovery.
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
] as const;

export function childProcessEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  // Build through a plain mutable record. Next augments ProcessEnv with a
  // readonly NODE_ENV property, but the final object remains structurally
  // compatible with Node's spawn options.
  const env: Record<string, string | undefined> = {};
  for (const name of ALLOWED_CHILD_ENV) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return {
    NODE_ENV: process.env.NODE_ENV,
    ...env,
    ...overrides,
  };
}
