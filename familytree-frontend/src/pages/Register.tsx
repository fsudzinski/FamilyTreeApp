import { useState } from "react";
import { register } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { Link, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

type Form = {
  email: string;
  password: string;
};

export default function Register() {
  const [form, setForm] = useState<Form>({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { status, refreshUser } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      await register(form);
      await refreshUser();
      navigate("/trees");

    } catch (err) {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data;
        setError(
          typeof body === "string"
            ? body
            : JSON.stringify(body ?? err.message, null, 2),
        );
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <main className="status-page"><p>Checking your session...</p></main>;
  }

  if (status === "authenticated") {
    return <Navigate to="/trees" replace />;
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Family tree</p>
        <h1>Start your family tree</h1>
        <p className="page-intro">Create an account to begin gathering your family history.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <pre className="form-error" role="alert">{error}</pre>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}