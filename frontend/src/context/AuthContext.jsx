import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tv_token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('tv_token', token);
    } else {
      localStorage.removeItem('tv_token');
    }
  }, [token]);

  const login = useCallback((userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  // Memoize context value so it doesn't trigger re-renders on every parent render
  const value = useMemo(
    () => ({ user, token, login, logout }),
    [user, token, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); // eslint-disable-line react-refresh/only-export-components
