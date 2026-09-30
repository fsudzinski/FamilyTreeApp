import { useState } from "react";
import { login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

type Form = {
  email: string;
  password: string;
};

export default function Login() {
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

      await login(form);
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
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <p>Checking your session...</p>;
  }

  if (status === "authenticated") {
    return <Navigate to="/trees" replace />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="password" value={form.password} onChange={handleChange} />

      <button disabled={loading}>
        {loading ? "Loading..." : "Login"}
      </button>

      {error && <pre style={{ color: "red" }}>{error}</pre>}
    </form>
  );

}