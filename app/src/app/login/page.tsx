export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main
      style={{
        maxWidth: 380,
        margin: "12vh auto",
        padding: "0 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, justifyContent: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "1.5px solid var(--navy)",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ transform: "rotate(-45deg)", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 13, color: "var(--navy)" }}>
            R&amp;K
          </span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20, fontFamily: "'Playfair Display', serif", color: "var(--navy)" }}>
            Rosenthal &amp; Kin
          </div>
          <div style={{ color: "var(--mono)", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Operator Console
          </div>
        </div>
      </div>

      <div style={{ background: "#fffdf6", border: "1px solid var(--line-soft)", borderRadius: 6, padding: "28px 24px" }}>
        {searchParams.error && (
          <div style={{ background: "var(--rust-bg)", color: "var(--rust)", padding: "10px 14px", borderRadius: 4, fontSize: 13, marginBottom: 16 }}>
            Incorrect email or password.
          </div>
        )}
        <form action="/api/auth/login" method="POST" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, color: "var(--dim)" }}>
            Email
            <input
              name="email"
              type="email"
              required
              autoFocus
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                marginTop: 6,
                border: "1px solid var(--line)",
                borderRadius: 4,
                background: "var(--cream2)",
                fontSize: 15,
                color: "var(--text)",
              }}
            />
          </label>
          <label style={{ fontSize: 13, color: "var(--dim)" }}>
            Password
            <input
              name="password"
              type="password"
              required
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                marginTop: 6,
                border: "1px solid var(--line)",
                borderRadius: 4,
                background: "var(--cream2)",
                fontSize: 15,
                color: "var(--text)",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: "13px 16px",
              marginTop: 6,
              borderRadius: 4,
              border: "none",
              background: "var(--gold)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
