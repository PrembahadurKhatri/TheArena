// Long-form document layout for the legal pages: a table of contents that
// stays put on wide screens, numbered sections at a reading measure.
export default function LegalDoc({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { title: string; text: string }[];
}) {
  const idOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <main className="flex-1">
      <header className="border-b border-border bg-base-2">
        <div className="container-x py-14 md:py-20">
          <h1 className="font-display text-5xl font-bold leading-[0.95] text-ink md:text-7xl">{title}</h1>
          <p className="mt-4 text-ink-faint">{updated}</p>
        </div>
      </header>

      <div className="container-x grid gap-12 py-12 md:py-16 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-ink-muted">On this page</p>
          <ol className="mt-4 flex flex-col gap-1 border-l border-border">
            {sections.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#${idOf(s.title)}`}
                  className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink"
                >
                  <span className="num text-ink-faint">{i + 1}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[68ch] flex-col">
          {sections.map((s, i) => (
            <section
              key={s.title}
              id={idOf(s.title)}
              className="scroll-mt-24 border-b border-border py-10 first:pt-0 last:border-0"
            >
              <p className="num font-display text-lg font-bold text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink">{s.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-muted">{s.text}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
