import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lexassist_user"));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!!localStorage.getItem("lexassist_token"));

  useEffect(() => {
    if (!localStorage.getItem("lexassist_token")) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("lexassist_token");
        localStorage.removeItem("lexassist_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem("lexassist_token", token);
    localStorage.setItem("lexassist_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("lexassist_token");
    localStorage.removeItem("lexassist_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
