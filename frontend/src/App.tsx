import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SupportHomePage } from "./pages/support/SupportHomePage";
import { AdminSupportCenterPage } from "./pages/support/AdminSupportCenterPage";
import { SupportDeveloperAssignmentPage } from "./pages/support/SupportDeveloperAssignmentPage";
import { SupportDeveloperWorkbenchPage } from "./pages/support/SupportDeveloperWorkbenchPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { useAuth } from "./state/AuthContext";
import { ToastProvider } from "./components/ui/AlertToast";
import { WmsBootScreen } from "./components/BootScreen";
import "./styles.css";

export function App() {
  const { isBooting } = useAuth();
  const location = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem("support_theme") !== "light");
  useEffect(() => localStorage.setItem("support_theme", dark ? "dark" : "light"), [dark]);
  if (isBooting) return <WmsBootScreen />;
  const isAuth = location.pathname === "/login" || location.pathname === "/reset-password";
  const { user } = useAuth();
  const protect = (page: React.ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;
  const admin = (page: React.ReactNode) => protect(user?.support_role === "ADMIN" ? page : <Navigate to="/support" replace />);
  return (
    <div className={dark ? "app dark" : "app"}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/support" replace />} />
          <Route path="/login" element={<LoginPage dark={dark} onToggleTheme={() => setDark((v) => !v)} />} />
          <Route path="/reset-password" element={<ResetPasswordPage dark={dark} onToggleTheme={() => setDark((v) => !v)} />} />
          <Route path="/support" element={protect(<SupportHomePage dark={dark} onToggleTheme={() => setDark((v) => !v)} />)} />
          <Route path="/support/admin" element={admin(<AdminSupportCenterPage />)} />
          <Route path="/support/developers" element={admin(<SupportDeveloperAssignmentPage />)} />
          <Route path="/support/workbench" element={protect(<SupportDeveloperWorkbenchPage />)} />
          <Route path="*" element={<Navigate to={isAuth ? "/login" : "/support"} replace />} />
        </Routes>
      </ToastProvider>
    </div>
  );
}
