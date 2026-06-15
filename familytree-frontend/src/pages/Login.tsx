import { useState } from "react";
import { login } from "../api/auth";

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
  
        alert("Logged in successfully!");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <form onSubmit={handleSubmit}>        
        <h1>Login</h1>
        <input name="email" value={form.email} onChange={handleChange} />
        <input name="password" value={form.password} onChange={handleChange} />
  
        <button disabled={loading}>
          {loading ? "Loading..." : "Login"}
        </button>
  
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    );

}