import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                const success = await login(formData.email, formData.password);
                if (!success) {
                    setError('Email ou mot de passe incorrect');
                }
            } else {
                if (formData.password !== formData.confirmPassword) {
                    setError('Les mots de passe ne correspondent pas');
                    setLoading(false);
                    return;
                }

                const success = await register(formData.email, formData.password, formData.name);
                if (!success) {
                    setError('Erreur lors de l\'inscription. Veuillez réessayer.');
                }
            }
        } catch (error) {
            setError('Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo">
                        <span className="logo-icon">🏛️</span>
                        <h1>JusticeAutomation</h1>
                    </div>
                    <p className="tagline">
                        Plateforme décentralisée pour l'accès aux documents légaux à Madagascar
                    </p>
                </div>

                <div className="login-tabs">
                    <button
                        className={`tab ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        Connexion
                    </button>
                    <button
                        className={`tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        Inscription
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {!isLogin && (
                        <div className="form-group">
                            <label htmlFor="name" className="form-label">
                                Nom complet
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="form-input"
                                required={!isLogin}
                                placeholder="Votre nom complet"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            Adresse email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="form-input"
                            required
                            placeholder="votre@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className="form-input"
                            required
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">
                                Confirmer le mot de passe
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                className="form-input"
                                required={!isLogin}
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="submit-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            isLogin ? 'Se connecter' : 'S\'inscrire'
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <div className="features">
                        <div className="feature">
                            <span className="feature-icon">🤖</span>
                            <span>IA & Blockchain</span>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">📱</span>
                            <span>Mode Hors Ligne</span>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">🌍</span>
                            <span>Multilingue</span>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
        }

        .login-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

        .login-header {
          text-align: center;
          padding: 2rem 2rem 1rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .logo-icon {
          font-size: 2rem;
        }

        .logo h1 {
          font-size: 1.5rem;
          color: #2c3e50;
          margin: 0;
        }

        .tagline {
          color: #7f8c8d;
          font-size: 0.9rem;
          line-height: 1.4;
          margin: 0;
        }

        .login-tabs {
          display: flex;
          background: #f8f9fa;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          color: #7f8c8d;
          transition: all 0.3s ease;
          border-bottom: 2px solid transparent;
        }

        .tab.active {
          color: #3498db;
          background: white;
          border-bottom-color: #3498db;
        }

        .login-form {
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #ecf0f1;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .error-message {
          background: #fff5f5;
          border: 1px solid #e74c3c;
          color: #c0392b;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .submit-button {
          width: 100%;
          padding: 0.875rem;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .submit-button:hover:not(:disabled) {
          background: #2980b9;
          transform: translateY(-2px);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .login-footer {
          padding: 1.5rem 2rem;
          background: #f8f9fa;
          border-top: 1px solid #ecf0f1;
        }

        .features {
          display: flex;
          justify-content: space-around;
          gap: 1rem;
        }

        .feature {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: #7f8c8d;
        }

        .feature-icon {
          font-size: 1.2rem;
        }

        @media (max-width: 480px) {
          .login-container {
            padding: 1rem;
          }

          .login-card {
            max-width: none;
          }

          .login-header,
          .login-form,
          .login-footer {
            padding-left: 1.5rem;
            padding-right: 1.5rem;
          }
        }
      `}</style>
        </div>
    );
};

export default Login;