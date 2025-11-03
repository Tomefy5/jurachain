import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import Header from './layout/Header';
import Sidebar from './layout/Sidebar';
import Dashboard from './pages/Dashboard';
import DocumentGenerator from './pages/DocumentGenerator';
import CollaborativeEditor from './pages/CollaborativeEditor';
import DigitalSignature from './pages/DigitalSignature';
import OfflineMode from './pages/OfflineMode';
import Login from './pages/Login';
import './App.css';

const App: React.FC = () => {
    return (
        <AuthProvider>
            <OfflineProvider>
                <Router>
                    <div className="app">
                        <AppContent />
                    </div>
                </Router>
            </OfflineProvider>
        </AuthProvider>
    );
};

const AppContent: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Chargement de JusticeAutomation...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    return (
        <div className="app-layout">
            <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="app-body">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/generate" element={<DocumentGenerator />} />
                        <Route path="/collaborate/:documentId?" element={<CollaborativeEditor />} />
                        <Route path="/sign/:documentId?" element={<DigitalSignature />} />
                        <Route path="/offline" element={<OfflineMode />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default App;