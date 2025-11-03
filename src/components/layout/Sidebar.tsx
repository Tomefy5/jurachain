import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      icon: '📊',
      label: 'Tableau de Bord',
      description: 'Vue d\'ensemble de vos documents'
    },
    {
      path: '/generate',
      icon: '✨',
      label: 'Générer Document',
      description: 'Créer un nouveau document légal'
    },
    {
      path: '/collaborate',
      icon: '👥',
      label: 'Édition Collaborative',
      description: 'Travailler en équipe sur un document'
    },
    {
      path: '/sign',
      icon: '✍️',
      label: 'Signature Numérique',
      description: 'Signer vos documents'
    },
    {
      path: '/offline',
      icon: '📱',
      label: 'Mode Hors Ligne',
      description: 'Fonctionnalités offline'
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Navigation</h3>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={onClose}
            >
              <div className="nav-icon">{item.icon}</div>
              <div className="nav-content">
                <div className="nav-label">{item.label}</div>
                <div className="nav-description">{item.description}</div>
              </div>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="app-info">
            <div className="app-version">Version 1.0.0</div>
            <div className="app-status">
              <span className="status-dot online"></span>
              Tous les services actifs
            </div>
          </div>
        </div>

        <style>{`
          .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 200;
          }

          .sidebar {
            position: fixed;
            top: 0;
            left: -320px;
            width: 320px;
            height: 100vh;
            background: white;
            box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
            transition: left 0.3s ease;
            z-index: 300;
            display: flex;
            flex-direction: column;
          }

          .sidebar.open {
            left: 0;
          }

          .sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #ecf0f1;
            background: #f8f9fa;
          }

          .sidebar-header h3 {
            margin: 0;
            color: #2c3e50;
            font-size: 1.1rem;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            color: #7f8c8d;
            padding: 0.25rem;
            border-radius: 4px;
            transition: all 0.3s ease;
          }

          .close-button:hover {
            background: #ecf0f1;
            color: #2c3e50;
          }

          .sidebar-nav {
            flex: 1;
            padding: 1rem 0;
            overflow-y: auto;
          }

          .nav-item {
            display: flex;
            align-items: center;
            padding: 1rem 1.5rem;
            text-decoration: none;
            color: #2c3e50;
            transition: all 0.3s ease;
            border-left: 3px solid transparent;
          }

          .nav-item:hover {
            background: #f8f9fa;
            border-left-color: #3498db;
          }

          .nav-item.active {
            background: #e3f2fd;
            border-left-color: #2196f3;
            color: #1976d2;
          }

          .nav-icon {
            font-size: 1.5rem;
            margin-right: 1rem;
            width: 24px;
            text-align: center;
          }

          .nav-content {
            flex: 1;
          }

          .nav-label {
            font-weight: 600;
            font-size: 0.95rem;
            margin-bottom: 0.25rem;
          }

          .nav-description {
            font-size: 0.8rem;
            color: #7f8c8d;
            line-height: 1.3;
          }

          .nav-item.active .nav-description {
            color: #1976d2;
            opacity: 0.8;
          }

          .sidebar-footer {
            padding: 1.5rem;
            border-top: 1px solid #ecf0f1;
            background: #f8f9fa;
          }

          .app-info {
            text-align: center;
          }

          .app-version {
            font-size: 0.8rem;
            color: #7f8c8d;
            margin-bottom: 0.5rem;
          }

          .app-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-size: 0.8rem;
            color: #27ae60;
          }

          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
          }

          .status-dot.online {
            background: #27ae60;
          }

          @media (min-width: 1024px) {
            .sidebar {
              position: relative;
              left: 0;
              width: 280px;
              box-shadow: none;
              border-right: 1px solid #ecf0f1;
            }

            .sidebar-overlay {
              display: none;
            }

            .close-button {
              display: none;
            }
          }

          @media (max-width: 768px) {
            .sidebar {
              width: 100vw;
              left: -100vw;
            }

            .sidebar.open {
              left: 0;
            }
          }
        `}</style>
      </aside>
    </>
  );
};

export default Sidebar;