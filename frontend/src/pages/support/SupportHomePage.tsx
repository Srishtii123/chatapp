import { Link, useNavigate } from "react-router-dom";
import { Headphones, LayoutDashboard, Users, Wrench } from "lucide-react";
import { SupportChatWidget } from "../../components/SupportChatWidget";
import { HeaderProfile } from "../../components/HeaderProfile";
import { useAuth } from "../../state/AuthContext";

export function SupportHomePage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.support_role === "ADMIN";
  return (
    <div className="workspace-main" style={{ minHeight: "100vh" }}>
      <header className="workspace-header">
        <div className="brand-mark"><Headphones size={24} /><strong>Support Chat</strong></div>
        <div className="workspace-header-actions"><SupportChatWidget /><HeaderProfile user={user} dark={dark} onToggleTheme={onToggleTheme} onLogout={() => { logout(); navigate("/login"); }} /></div>
      </header>
      <main className="workspace-content">
        <section className="page-heading"><div><span className="eyebrow">Support desk</span><h1>How can we help?</h1><p>Use the chat button in the header to create a ticket or continue a conversation.</p></div></section>
        {isAdmin && <div className="selection-grid">
          <Link className="module-card" to="/support/admin"><LayoutDashboard /><h3>Admin support center</h3><p>Monitor and reply to all tickets.</p></Link>
          <Link className="module-card" to="/support/developers"><Users /><h3>Developer assignment</h3><p>Manage support developers and assignments.</p></Link>
          <Link className="module-card" to="/support/workbench"><Wrench /><h3>Developer workbench</h3><p>Track assigned work and status.</p></Link>
        </div>}
      </main>
    </div>
  );
}
