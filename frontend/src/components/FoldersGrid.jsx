export default function FoldersGrid() {
    const folders = [
        { id: 1, name: "Lecture Notes", items: 12, color: "#6366f1", icon: "🎓" },
        { id: 2, name: "Assignments", items: 5, color: "#ec4899", icon: "📝" },
        { id: 3, name: "Shared Resources", items: 8, color: "#f59e0b", icon: "🔗" },
        { id: 4, name: "Recordings", items: 3, color: "#10b981", icon: "📹" },
    ];

    return (
        <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.1rem' }}>Folders</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--spacing-md)' }}>
                {folders.map(folder => (
                    <div key={folder.id} className="card" style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                        cursor: 'pointer', padding: '20px'
                    }}>
                        <div style={{
                            width: 50, height: 50, borderRadius: 14,
                            backgroundColor: folder.color + '20',
                            color: folder.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem',
                            boxShadow: `0 4px 10px ${folder.color}30`
                        }}>
                            {folder.icon}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{folder.name}</div>
                            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>{folder.items} items</div>
                        </div>
                        <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
