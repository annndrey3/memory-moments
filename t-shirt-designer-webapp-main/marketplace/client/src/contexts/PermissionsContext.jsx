import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const Ctx = createContext({ permissions: null, role: null, can: () => false, loading: true });

export function usePermissions() {
  return useContext(Ctx);
}

export function PermissionsProvider({ children }) {
  const [state, setState] = useState({ permissions: null, role: null, loading: true });

  useEffect(() => {
    if (!api.getToken()) {
      setState({ permissions: null, role: null, loading: false });
      return;
    }
    api.me()
      .then(({ admin }) =>
        setState({
          permissions: admin.permissions,
          role: admin.role,
          loading: false,
        })
      )
      .catch(() => setState({ permissions: null, role: null, loading: false }));
  }, []);

  // superadmin → always true; manage implies view
  const can = (perm) => {
    if (state.role === "superadmin") return true;
    const perms = Array.isArray(state.permissions) ? state.permissions : [];
    if (perms.includes(perm)) return true;
    if (perm.endsWith(".view")) {
      return perms.includes(perm.replace(".view", ".manage"));
    }
    return false;
  };

  return <Ctx.Provider value={{ ...state, can }}>{children}</Ctx.Provider>;
}
