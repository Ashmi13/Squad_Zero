import { useTheme } from "../context/ThemeContext";

export default function Topbar() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="glass topbar">
            <div>
                <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Welcome back, User! 👋</h1>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>Here's what's happening today.</p>
            </div>

            <div className="flex items-center gap-lg">
                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-input"
                    />
                    <span className="search-icon">🔍</span>
                </div>

                <div className="user-actions">
                    <button
                        onClick={toggleTheme}
                        className="notification-btn"
                        style={{ marginRight: 8 }}
                        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <button className="notification-btn">
                        🔔
                    </button>

                    <div className="user-avatar" />
                </div>
            </div>
        </header>
    );
}
