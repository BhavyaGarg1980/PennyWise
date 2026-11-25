import { useState, useEffect, useRef } from "react";
import "./styles.css";

const API_URL = "http://localhost:5000/api/auth";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleButtonRef = useRef(null);

  // Handle successful Google authentication
  async function handleGoogleLogin(response) {
    setError("");
    setLoading(true);

    try {
      const result = await fetch(`${API_URL}/google`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.message || "Google login failed.");
      }

      onLogin(data.user);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load Google Identity Services and render the Google button
  useEffect(() => {
    if (isRegister || !GOOGLE_CLIENT_ID) {
      return;
    }

    let cancelled = false;

    function initializeGoogle() {
      if (
        cancelled ||
        !googleButtonRef.current ||
        !window.google?.accounts?.id
      ) {
        return;
      }

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
      });

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 320,
        }
      );
    }

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      if (window.google?.accounts?.id) {
        initializeGoogle();
      } else {
        existingScript.addEventListener("load", initializeGoogle);
      }
    } else {
      const script = document.createElement("script");

      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => {
        if (!cancelled) {
          setError("Unable to load Google Sign-In. Please try again.");
        }
      };

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;

      const script = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );

      script?.removeEventListener("load", initializeGoogle);
    };
  }, [isRegister]);

  // Handle email/password login and registration
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "register" : "login";

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isRegister ? { name, currency } : {}),
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      onLogin(data.user);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">P</div>

        <h1>Welcome to PennyWise</h1>

        <p className="auth-subtitle">
          {isRegister
            ? "Create your account and take control of your finances."
            : "Sign in to manage your personal finances."}
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={!isRegister ? "active" : ""}
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
          >
            Log in
          </button>

          <button
            type="button"
            className={isRegister ? "active" : ""}
            onClick={() => {
              setIsRegister(true);
              setError("");
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label htmlFor="auth-name">Full name</label>

              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                required
              />
            </>
          )}

          <label htmlFor="auth-email">Email address</label>

          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="auth-password">Password</label>

          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isRegister ? "At least 8 characters" : "Enter your password"
            }
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />

          {isRegister && (
            <>
              <label htmlFor="auth-currency">Preferred currency</label>

              <select
                id="auth-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
              </select>
            </>
          )}

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        {!isRegister && (
          <div className="google-login-section">
            <div className="auth-divider">
              <span>or</span>
            </div>

            {!GOOGLE_CLIENT_ID ? (
              <p className="auth-error">
                Google Client ID is missing. Check your frontend .env file.
              </p>
            ) : (
              <div
                className="google-button-container"
                ref={googleButtonRef}
              />
            )}
          </div>
        )}

        <p className="auth-footer">
          {isRegister
            ? "Already have an account?"
            : "New to PennyWise?"}{" "}

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}