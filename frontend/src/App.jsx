import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import Research from "./pages/Research";
import Documents from "./pages/Documents";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/cases" element={<Cases />} />
                  <Route path="/cases/:id" element={<CaseDetail />} />
                  <Route path="/research" element={<Research />} />
                  <Route path="/chat" element={<Navigate to="/research" replace />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/upload" element={<Upload />} />
                  {/* Redirect old routes */}
                  <Route path="/knowledge" element={<Navigate to="/documents" replace />} />
                  <Route path="/brief" element={<Navigate to="/cases" replace />} />
                  <Route path="/insights" element={<Navigate to="/" replace />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
