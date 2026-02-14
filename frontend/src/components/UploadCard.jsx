import { useNavigate } from "react-router-dom";

export default function UploadCard() {
    const navigate = useNavigate();

    return (
        <div className="card" style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            cursor: 'pointer',
            textAlign: 'center',
            minHeight: 200
        }} onClick={() => navigate('/upload')}>
            <div style={{ fontSize: '3rem', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ☁️
            </div>
            <div>
                <h3 style={{ margin: 0, color: 'white' }}>Upload New Material</h3>
                <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>Drag & drop or click to browse</p>
            </div>
        </div>
    );
}
