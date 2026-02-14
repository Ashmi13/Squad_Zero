import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    const links = [
        { path: "/", label: "Dashboard", icon: "🏠" },
        { path: "/materials", label: "Materials", icon: "📚" },
        { path: "/upload", label: "Upload", icon: "☁️" },
        { path: "/favorites", label: "Favorites", icon: "⭐" },
        { path: "/settings", label: "Settings", icon: "⚙️" },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-logo" />
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>Squad Zero</h2>
            </div>

            <nav className="sidebar-nav">
                {links.map((link) => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{link.icon}</span>
                        {link.label}
                    </Link>
                ))}
            </nav>

            <div className="storage-indicator">
                <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                    <small className="text-muted" style={{ fontWeight: 600 }}>Storage</small>
                    <small className="text-muted">75%</small>
                </div>
                <div style={{
                    height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 3, overflow: 'hidden'
                }}>
                    <div style={{ width: '75%', height: '100%', backgroundColor: 'var(--secondary)', boxShadow: '0 0 10px var(--secondary-glow)' }} />
                </div>
                <small className="text-muted" style={{ display: 'block', marginTop: 8, fontSize: '0.75rem' }}>7.5GB used of 10GB</small>
            </div>
        </aside>
    );
}
