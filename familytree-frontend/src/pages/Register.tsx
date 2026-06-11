import { useState } from "react";
import { register } from "../api/auth";

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      await register(form);

      alert("Registered successfully!");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="password" value={form.password} onChange={handleChange} />

      <button disabled={loading}>
        {loading ? "Loading..." : "Register"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}