export default function RecentFiles() {
    const files = [
        { id: 1, name: "Project_Specs_Final.pdf", type: "PDF", size: "2.4 MB", date: "2 hrs ago" },
        { id: 2, name: "Design_Assets_v2.zip", type: "ZIP", size: "154 MB", date: "5 hrs ago" },
        { id: 3, name: "Team_Meeting_Notes.docx", type: "DOC", size: "15 KB", date: "Yesterday" },
        { id: 4, name: "Q1_Budget_2026.xlsx", type: "XLS", size: "45 KB", date: "2 days ago" },
    ];

    const getIcon = (type) => {
        switch (type) {
            case 'PDF': return <span style={{ color: '#ef4444' }}>📄</span>;
            case 'ZIP': return <span style={{ color: '#eab308' }}>📦</span>;
            case 'XLS': return <span style={{ color: '#22c55e' }}>📊</span>;
            case 'DOC': return <span style={{ color: '#3b82f6' }}>📝</span>;
            default: return '📄';
        }
    };

    return (
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Files</h3>
                <a href="#" style={{ fontSize: '0.875rem', fontWeight: 500 }}>View All</a>
            </div>

            <div className="flex gap-md" style={{ overflowX: 'auto', paddingBottom: 12 }}>
                {files.map(file => (
                    <div key={file.id} className="card" style={{
                        minWidth: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-md)',
                        cursor: 'pointer',
                        padding: '20px'
                    }}>
                        <div className="flex justify-between items-start">
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.25rem'
                            }}>
                                {getIcon(file.type)}
                            </div>
                            <button style={{
                                padding: 4, background: 'transparent', boxShadow: 'none',
                                color: 'var(--text-muted)', width: 'auto', height: 'auto'
                            }}>⋮</button>
                        </div>

                        <div>
                            <div style={{
                                fontWeight: 600, whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                marginBottom: 4
                            }}>
                                {file.name}
                            </div>
                            <div className="flex justify-between items-center text-muted" style={{ fontSize: '0.75rem' }}>
                                <span>{file.size}</span>
                                <span>{file.date}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
