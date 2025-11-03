import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isOnline } = useOffline();

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-button" onClick={onMenuClick}>
          <span className="hamburger"></span>
        </button>
        <div className="logo">
          <span className="logo-icon">🏛️</span>
          <span className="logo-text">JusticeAutomation</span>
        </div>
      </div>

      <div className="header-center">
        <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </div>
      </div>

      <div className="header-right">
        <div className="user-menu">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="logout-button" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </div>

      <style>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 4px;
          transition: background-color 0.3s ease;
        }

        .menu-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .hamburger {
          display: block;
          width: 20px;
          height: 2px;
          background: white;
          position: relative;
        }

        .hamburger::before,
        .hamburger::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 2px;
          background: white;
          left: 0;
        }

        .hamburger::before {
          top: -6px;
        }

        .hamburger::after {
          top: 6px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .logo-icon {
          font-size: 1.5rem;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .connection-status.online {
          background: rgba(39, 174, 96, 0.2);
          border: 1px solid rgba(39, 174, 96, 0.3);
        }

        .connection-status.offline {
          background: rgba(231, 76, 60, 0.2);
          border: 1px solid rgba(231, 76, 60, 0.3);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .connection-status.online .status-dot {
          background: #27ae60;
        }

        .connection-status.offline .status-dot {
          background: #e74c3c;
        }

        .header-right {
          display: flex;
          align-items: center;
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-size: 0.875rem;
        }

        .user-name {
          font-weight: 600;
        }

        .user-email {
          opacity: 0.8;
          font-size: 0.8rem;
        }

        .logout-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.3s ease;
        }

        .logout-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
        }

        @media (max-width: 768px) {
          .header {
            padding: 1rem;
          }

          .user-info {
            display: none;
          }

          .logo-text {
            display: none;
          }

          .connection-status {
            font-size: 0.8rem;
            padding: 0.25rem 0.75rem;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;