import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@memory-moments.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api.login(email, password);
      api.setToken(token);
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo-hashtag.png"
            alt="Memory Moments"
            className="mx-auto mb-4 h-12 w-auto max-w-[260px] object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900">Адмін-панель</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft space-y-4"
        >
          {error && (
            <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{error}</div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11">
            <Lock className="h-4 w-4" />
            {loading ? "Вхід..." : "Увійти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
