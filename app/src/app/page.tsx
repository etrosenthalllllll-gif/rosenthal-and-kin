// Placeholder root page. The real landing surfaces are ops.* (operator
// dashboard, doc 02) and portal.* (claimant portal, doc 05) — see
// docs/decisions/hosting-and-stack.md. This route exists so the app
// builds and deploys; it is not the product itself.
export default function HomePage() {
  return (
    <main>
      <h1>Rosenthal &amp; Kin</h1>
      <p>Backend under construction. See PLAN.md for build status.</p>
    </main>
  );
}
