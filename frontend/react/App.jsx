import React from "react";

export default function App() {
  return (
    <main className="migration-shell">
      <section className="migration-card" aria-labelledby="app-title">
        <p className="migration-eyebrow">Convosis Books</p>
        <h1 id="app-title">React frontend foundation</h1>
        <p>
          The React 19 build is ready. Existing accounting workflows remain
          available in the current application while screens are migrated.
        </p>
        <a className="migration-link" href="/">
          Open Convosis Books
        </a>
      </section>
    </main>
  );
}
