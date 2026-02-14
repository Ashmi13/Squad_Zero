export default function MaterialsList() {
  const materials = [
    { id: 1, title: "DBMS Lecture 01", instruction: "Summarize + 5 MCQs" },
    { id: 2, title: "OOAD Slides", instruction: "Explain with examples" },
  ];

  return (
    <div className="flex flex-col gap-md">
      <h2>Materials List</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
        {materials.map((m) => (
          <div key={m.id} className="card flex flex-col gap-sm">
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{m.title}</h3>
            <p className="text-muted" style={{ margin: 0 }}>{m.instruction}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
