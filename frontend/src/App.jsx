import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import './index.css';

const AppContent = () => {
  // Start with null to show the login/onboarding flow from the beginning
  const [userProfile, setUserProfile] = useState(null);

  const handleOnboardingComplete = (profile) => {
    setUserProfile(profile);
    localStorage.setItem('tv_profile', JSON.stringify(profile));
  };

  return (
    <Routes>
      {!userProfile ? (
        <Route path="*" element={<Onboarding onComplete={handleOnboardingComplete} />} />
      ) : (
        <>
          <Route path="/dashboard" element={<Dashboard userProfile={userProfile} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      )}
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
