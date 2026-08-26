export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main
      style={{
        maxWidth: 360,
        margin: "10vh auto",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: "1.5rem" }}>Rosenthal &amp; Kin</h1>
      {searchParams.error && (
        <p style={{ color: "#b91c1c", marginTop: 0 }}>
          Incorrect email or password.
        </p>
      )}
      <form action="/api/auth/login" method="POST" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required autoFocus style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
        </label>
        <label>
          Password
          <input name="password" type="password" required style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }} />
        </label>
        <button type="submit" style={{ padding: "0.5rem", marginTop: "0.5rem", cursor: "pointer" }}>
          Sign in
        </button>
      </form>
    </main>
  );
}
