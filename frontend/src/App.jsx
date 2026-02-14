import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import RecentFiles from "./components/RecentFiles";
import FoldersGrid from "./components/FoldersGrid";
import UploadCard from "./components/UploadCard";
import UploadMaterial from "./pages/UploadMaterial";
import MaterialsList from "./pages/MaterialsList";

function Dashboard() {
  return (
    <div className="flex flex-col gap-xl">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-lg)' }}>
        <div className="flex flex-col gap-xl">
          <RecentFiles />
          <FoldersGrid />
        </div>
        <UploadCard />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell fade-in">
      <Sidebar />

      <main className="main-content">
        <Topbar />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadMaterial />} />
          <Route path="/materials" element={<MaterialsList />} />
        </Routes>
      </main>
    </div>
  );
}
