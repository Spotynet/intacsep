import React, {useState} from "react";
import {useAuth} from "../context/AuthContext";
import {useNavigate} from "react-router-dom";

const Login = () => {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const navigate = useNavigate();
  const {login} = useAuth();
  const [formData, setFormData] = useState({email: "", password: ""});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestPasswordReset = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setIsLoading(true);
    try {
      const response = await fetch(`${baseUrl}/request-reset-password`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email: resetEmail}),
      });
      const data = await response.json();
      if (response.ok) {
        setResetSuccess("Enlace enviado. Revisa tu correo.");
      } else {
        setResetError(data.message || "Error al enviar enlace.");
      }
    } catch {
      setResetError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForm = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({...prev, [name]: value}));
    if (errorMessage) setErrorMessage("");
  };

  const loginUser = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch {
      setErrorMessage("Correo o contraseña incorrectos.");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login">
      {/* Aurora background orbs */}
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />

      <div className="lp-card">
        {/* Gradient top border line */}
        <div className="lp-card__top-line" />

        {/* Logo */}
        <div className="lp-logo">
          <img src="./logo1.png" alt="Intacsep" />
        </div>

        {isResettingPassword ? (
          <div className="lp-body" key="reset">
            <div className="lp-header">
              <h1 className="lp-header__title">Recuperar acceso</h1>
              <p className="lp-header__sub">Ingresa tu correo y te enviaremos un enlace.</p>
            </div>

            <form onSubmit={requestPasswordReset} className="lp-form">
              <div className="lp-field">
                <label className="lp-field__label" htmlFor="resetEmail">Correo electrónico</label>
                <div className="lp-field__wrap">
                  <i className="fa-regular fa-envelope lp-field__icon" />
                  <input
                    id="resetEmail"
                    type="email"
                    className="lp-field__input"
                    placeholder="tu@correo.com"
                    required
                    autoFocus
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setResetError(""); setResetSuccess(""); }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {resetError   && <div className="lp-msg lp-msg--error"><i className="fa-solid fa-circle-exclamation" />{resetError}</div>}
              {resetSuccess && <div className="lp-msg lp-msg--ok"><i className="fa-solid fa-circle-check" />{resetSuccess}</div>}

              <button type="submit" className="lp-btn" disabled={isLoading}>
                {isLoading ? <span className="spinner-border spinner-border-sm" /> : "Enviar enlace"}
              </button>

              <button type="button" className="lp-back-btn"
                onClick={() => { setIsResettingPassword(false); setResetError(""); setResetSuccess(""); }}>
                <i className="fa-solid fa-arrow-left" /> Volver al inicio de sesión
              </button>
            </form>
          </div>
        ) : (
          <div className="lp-body" key="login">
            <div className="lp-header">
              <h1 className="lp-header__title">Bienvenido</h1>
              <p className="lp-header__sub">Ingresa tus credenciales para continuar.</p>
            </div>

            <form onSubmit={loginUser} className="lp-form">
              <div className="lp-field">
                <label className="lp-field__label" htmlFor="email">Correo electrónico</label>
                <div className="lp-field__wrap">
                  <i className="fa-regular fa-envelope lp-field__icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="lp-field__input"
                    placeholder="tu@correo.com"
                    required
                    autoFocus
                    value={formData.email}
                    onChange={handleForm}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="lp-field">
                <div className="lp-field__label-row">
                  <label className="lp-field__label" htmlFor="password">Contraseña</label>
                  <button type="button" className="lp-forgot" onClick={() => setIsResettingPassword(true)}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="lp-field__wrap">
                  <i className="fa-solid fa-lock lp-field__icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="lp-field__input lp-field__input--pr"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={handleForm}
                    autoComplete="current-password"
                  />
                  <button type="button" className="lp-field__eye" tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}>
                    <i className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="lp-msg lp-msg--error">
                  <i className="fa-solid fa-circle-exclamation" />{errorMessage}
                </div>
              )}

              <button type="submit" className="lp-btn" disabled={isLoading}>
                {isLoading
                  ? <><span className="spinner-border spinner-border-sm" /> Entrando…</>
                  : "Iniciar sesión"}
              </button>
            </form>
          </div>
        )}

        <footer className="lp-footer">
          <a href="https://www.spotynet.com/" target="_blank" rel="noopener noreferrer">Powered by © Spotynet 2026 on AWS</a>
          <span>·</span><span>v 4.0</span>
        </footer>
      </div>
    </div>
  );
};

export default Login;
